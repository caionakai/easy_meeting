import React, { useEffect, useState, useRef, useCallback } from "react";
import logo from "./logo.svg";
import "./App.css";
import socket from "./config/apiConfig";
import myPeer from "./config/peer";
import Video from "./Video";

// const myPeer = new window.Peer();

// after the peer is created an ID is sent to server

function App() {
  // user own video
  const ref = useRef(null);
  const [peers, setPeers] = useState({});
  const [video, setVideo] = useState([
    {
      id: "myself",
      video: <video width="300" height="300" autoPlay ref={ref} muted />,
      isActive: true,
    },
  ]);

  useEffect(() => {
    let myOwnId = null;
    myPeer.on("open", (id) => {
      if (!id) return;
      myOwnId = id;
      socket.emit("user-connected", id);
    });

    return () => {
      socket.emit("manual-disconnect", myOwnId);
      myPeer.destroy();
    };
  }, []);

  useEffect(() => {
    socket.off("user-disconnected").on("user-disconnected", ({ userId }) => {
      if (peers[userId]) peers[userId].close();
    });
  }, [peers]);

  const addVideoStream = useCallback((idx, stream) => {
    setVideo((prevState) => {
      let tmp = [...prevState];
      tmp[idx].video.ref.current.srcObject = stream;
      return tmp;
    });
  }, []);

  const createVideo = useCallback((id) => {
    let newVideoIdx = 0;
    setVideo((prevState) => {
      let tmp = [...prevState];
      newVideoIdx = tmp.length;
      tmp.push({
        id,
        video: (
          <video
            width="300"
            height="300"
            autoPlay
            ref={React.createRef()}
            muted
          />
        ),
        isActive: true,
      });
      return tmp;
    });

    return newVideoIdx;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const removeVideo = useCallback((videoIdx) => {
    setVideo((prevState) => {
      let tmp = [...prevState];
      tmp[videoIdx].isActive = false;
      return tmp;
    });
  }, []);

  const connectToNewUser = useCallback(
    (userId, stream) => {
      const call = myPeer.call(userId, stream);
      // const video = document.createElement('video')
      const newVideoIdx = createVideo(userId);

      call.on("stream", (userVideoStream) => {
        addVideoStream(newVideoIdx, userVideoStream);
      });
      call.on("close", () => {
        removeVideo(newVideoIdx);
      });

      setPeers((prevState) => {
        let tmp = { ...prevState };
        tmp[userId] = call;
        return tmp;
      });
    },
    [addVideoStream, createVideo, removeVideo]
  );

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({
        video: true,
        audio: true,
      })
      .then((stream) => {
        addVideoStream(0, stream); // own video

        socket.emit("user-connected");

        myPeer.on("call", (call) => {
          call.answer(stream);

          setPeers((prevState) => {
            let tmp = { ...prevState };
            tmp[call.peer] = call;
            return tmp;
          });

          const newVideoIdx = createVideo(call.peer);

          call.on("stream", (userVideoStream) => {
            addVideoStream(newVideoIdx, userVideoStream);
          });

          call.on("close", () => {
            removeVideo(newVideoIdx);
          });
        });

        socket.off("user-connected").on("user-connected", ({ userId }) => {
          connectToNewUser(userId, stream);
        });
      });
  }, [addVideoStream, connectToNewUser, createVideo, removeVideo]);

  return (
    <div className="App">
      <h1>Easy Meeting</h1>
      <div
        style={{
          display: "flex",
          width: "80%",
          justifyContent: "space-evenly",
          flexWrap: "wrap",
        }}
      >
        {video.map((video) => {
          if (video.isActive) return video.video;
        })}
      </div>
    </div>
  );
}

export default App;
