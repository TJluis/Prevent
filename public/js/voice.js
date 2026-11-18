const HEAR_RADIUS = 14;
const STUN_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

export function createVoiceManager({ getId, sendSignal }) {
  const peers = new Map();
  let localStream = null;
  let audioContext = null;
  let running = false;
  const pending = [];

  function ensureAudioContext() {
    if (!audioContext) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) throw new Error("AudioContext no disponible");
      audioContext = new Ctor();
    }
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }
    return audioContext;
  }

  async function start() {
    if (running && localStream) return localStream;
    ensureAudioContext();

    if (!localStream) {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      } catch (err) {
        localStream = null;
        throw err;
      }
    }

    running = true;
    for (const id of [...peers.keys()]) {
      addLocalTracks(id);
    }
    for (const signal of pending) {
      handleSignal(signal);
    }
    pending.length = 0;
    return localStream;
  }

  function addLocalTracks(id) {
    const { pc } = peers.get(id);
    if (!pc || !localStream) return;
    for (const track of localStream.getAudioTracks()) {
      if (!pc.getSenders().some((sender) => sender.track === track)) {
        pc.addTrack(track, localStream);
      }
    }
  }

  function createPeer(id) {
    const ctx = ensureAudioContext();
    const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
    const audio = new Audio();
    audio.autoplay = true;
    audio.volume = 0;

    const source = ctx.createMediaElementSource(audio);
    const panner = ctx.createStereoPanner();
    source.connect(panner);
    panner.connect(ctx.destination);

    const peer = { pc, audio, panner, lastPos: null };
    peers.set(id, peer);

    if (localStream) {
      localStream.getAudioTracks().forEach((track) => pc.addTrack(track, localStream));
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal("ice", id, { candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        audio.srcObject = event.streams[0];
        audio.play().catch(() => {});
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") {
        console.warn("[voice] conexión falló con", id);
      }
    };

    const hasPendingOffer = pending.some((signal) => signal.from === id && signal.type === "offer");
    if (getId() < id && !hasPendingOffer) {
      createOffer(peer, id);
    }

    for (const signal of pending) {
      if (signal.from === id) {
        handleSignal(signal);
      }
    }
    return peer;
  }

  function createOffer(peer, id) {
    peer.pc
      .createOffer()
      .then((offer) => peer.pc.setLocalDescription(offer))
      .then(() => sendSignal("offer", id, { sdp: peer.pc.localDescription }))
      .catch((err) => {
        console.error("[voice] crear oferta", err);
        cleanupPeer(id);
      });
  }

  function handleSignal({ type, from, sdp, candidate }) {
    if (from === getId()) return;

    let peer = peers.get(from);
    if (!peer) {
      if (!running) {
        pending.push({ type, from, sdp, candidate });
        return;
      }
      peer = createPeer(from);
    }

    const { pc } = peer;

    if ((type === "offer" || type === "answer") && sdp) {
      pc.setRemoteDescription(sdp)
        .then(() => {
          if (type === "offer") {
            return pc
              .createAnswer()
              .then((answer) => pc.setLocalDescription(answer))
              .then(() => sendSignal("answer", from, { sdp: pc.localDescription }));
          }
        })
        .catch((err) => {
          console.error("[voice] SDP", err);
        });
    } else if (type === "ice" && candidate) {
      pc.addIceCandidate(candidate).catch(() => {
        pending.push({ type, from, sdp, candidate });
      });
    }
  }

  function setContacts(players) {
    if (!running) return;

    const ids = new Set(
      players
        .filter((player) => player.id !== getId())
        .map((player) => player.id)
    );

    for (const id of [...peers.keys()]) {
      if (!ids.has(id)) cleanupPeer(id);
    }
    for (const id of ids) {
      if (!peers.has(id)) createPeer(id);
    }
  }

  function updatePositions(me, positions) {
    if (!running) return;

    for (const [id, peer] of peers) {
      const pos = peer.lastPos;
      if (!pos) {
        peer.audio.volume = 0;
        continue;
      }
      const dx = pos.x - me.x;
      const dz = pos.z - me.z;
      const dist = Math.hypot(dx, dz);
      const falloff = Math.max(0, 1 - dist / HEAR_RADIUS);
      peer.audio.volume = Math.pow(falloff, 1.5);
      peer.panner.pan.value = Math.max(-1, Math.min(1, dx / HEAR_RADIUS));
    }
  }

  function rememberPosition(id, x, z) {
    const peer = peers.get(id);
    if (peer) peer.lastPos = { x, z };
  }

  function setMicEnabled(enabled) {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !!enabled;
      });
    }
  }

  function cleanupPeer(id) {
    const peer = peers.get(id);
    if (!peer) return;
    peer.pc.close();
    peer.audio.srcObject = null;
    peer.audio.pause();
    peers.delete(id);
  }

  function stop() {
    for (const id of [...peers.keys()]) cleanupPeer(id);
    peers.clear();
    pending.length = 0;
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      localStream = null;
    }
    running = false;
    if (audioContext) {
      audioContext.close().catch(() => {});
      audioContext = null;
    }
  }

  return {
    start,
    setContacts,
    handleSignal,
    updatePositions,
    rememberPosition,
    setMicEnabled,
    stop,
  };
}