const stateEl = document.getElementById("state");
const joinBtn = document.getElementById("join");
const localAudio = document.getElementById("localAudio");
const remoteAudio = document.getElementById("remoteAudio");

let pc = null;
let socket = null;
let peerId = null;

function setState(text) {
  stateEl.textContent = text;
}

joinBtn.addEventListener("click", start);

async function start() {
  joinBtn.disabled = true;

  setState("pidiendo acceso al micrófono…");
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    setState(`micrófono bloqueado: ${err.message}`);
    joinBtn.disabled = false;
    return;
  }
  localAudio.srcObject = stream;

  socket = io();
  setState("conectando al servidor de señalización…");

  socket.on("connect", () => {
    setState("buscando otra pestaña…");
    socket.emit("spike:join");
  });

  socket.on("spike:paired", async ({ peerId: id, initiator }) => {
    peerId = id;
    setState(`pareja encontrada — ${initiator ? "creando oferta" : "contestando"}…`);

    pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    stream.getAudioTracks().forEach((track) => pc.addTrack(track, stream));

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("spike:ice", { target: peerId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      remoteAudio.srcObject = event.streams[0];
      setState("¡AUDIO ACTIVO! Deberías oír a tu pareja.");
    };

    socket.on("spike:sdp", async ({ sdp, from }) => {
      if (from !== peerId) return;
      try {
        await pc.setRemoteDescription(sdp);
        if (sdp.type === "offer") {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("spike:sdp", { target: peerId, sdp: pc.localDescription });
        }
      } catch (err) {
        setState(`error SDP: ${err.message}`);
      }
    });

    socket.on("spike:ice", async ({ candidate, from }) => {
      if (from !== peerId) return;
      try {
        await pc.addIceCandidate(candidate);
      } catch (err) {
        setState(`error ICE: ${err.message}`);
      }
    });

    if (initiator) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("spike:sdp", { target: peerId, sdp: pc.localDescription });
      } catch (err) {
        setState(`error al crear la oferta: ${err.message}`);
      }
    }
  });

  socket.on("spike:peer-left", () => {
    setState("la pareja salió de la prueba. Recarga la página para intentar de nuevo.");
    if (pc) pc.close();
    pc = null;
    joinBtn.disabled = false;
  });
}