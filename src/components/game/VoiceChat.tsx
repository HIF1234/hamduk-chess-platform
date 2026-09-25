import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Loader2, Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Peer-to-peer audio between the two players. Signalling goes over a private Realtime
// channel (voice:<game id>) that only the two players can join; the audio itself flows
// browser to browser. A TURN relay (VITE_TURN_*) helps players behind strict mobile NATs.
const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ...(import.meta.env.VITE_TURN_URLS
    ? [
        {
          urls: String(import.meta.env.VITE_TURN_URLS).split(","),
          username: import.meta.env.VITE_TURN_USERNAME as string,
          credential: import.meta.env.VITE_TURN_CREDENTIAL as string,
        },
      ]
    : []),
];

type Phase = "idle" | "requesting" | "incoming" | "connecting" | "live";
type Signal =
  | { type: "request" | "accept" | "decline" | "hangup"; from: string }
  | { type: "offer" | "answer"; from: string; sdp: RTCSessionDescriptionInit }
  | { type: "ice"; from: string; candidate: RTCIceCandidateInit };

export function VoiceChat({
  gameId,
  myId,
  opponentName,
}: {
  gameId: string;
  myId: string;
  opponentName: string;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [muted, setMuted] = useState(false);
  const channel = useRef<RealtimeChannel | null>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const mic = useRef<MediaStream | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);

  const send = useCallback(
    (msg: Signal) =>
      void channel.current?.send({ type: "broadcast", event: "voice", payload: msg }),
    [],
  );

  const teardown = useCallback(() => {
    pc.current?.close();
    pc.current = null;
    mic.current?.getTracks().forEach((t) => t.stop());
    mic.current = null;
    pendingIce.current = [];
    setMuted(false);
    setPhase("idle");
  }, []);

  async function getMic() {
    if (mic.current) return mic.current;
    try {
      mic.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      return mic.current;
    } catch {
      toast.error("Microphone access was blocked. Allow it in your browser to use voice chat.");
      return null;
    }
  }

  const makePeer = useCallback(
    (stream: MediaStream) => {
      const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      stream.getTracks().forEach((t) => peer.addTrack(t, stream));
      peer.onicecandidate = (e) => {
        if (e.candidate) send({ type: "ice", from: myId, candidate: e.candidate.toJSON() });
      };
      peer.ontrack = (e) => {
        if (audio.current) audio.current.srcObject = e.streams[0];
      };
      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "connected") setPhase("live");
        if (peer.connectionState === "failed") {
          toast.error("Voice couldn't connect. One of your networks may be blocking it.");
          teardown();
        }
      };
      pc.current = peer;
      return peer;
    },
    [myId, send, teardown],
  );

  useEffect(() => {
    let cancelled = false;
    async function join() {
      await supabase.realtime.setAuth();
      if (cancelled) return;
      const ch = supabase.channel(`voice:${gameId}`, {
        config: { private: true, broadcast: { self: false } },
      });
      ch.on("broadcast", { event: "voice" }, async ({ payload }) => {
        const msg = payload as Signal;
        if (msg.from === myId) return;
        switch (msg.type) {
          case "request":
            setPhase((p) => (p === "idle" ? "incoming" : p));
            break;
          case "decline":
            toast.info(`${opponentName} declined voice chat.`);
            teardown();
            break;
          case "hangup":
            toast.info("Voice chat ended.");
            teardown();
            break;
          case "accept": {
            // We asked; now start the call.
            if (!mic.current) return;
            setPhase("connecting");
            const peer = makePeer(mic.current);
            const offer = await peer.createOffer();
            await peer.setLocalDescription(offer);
            send({ type: "offer", from: myId, sdp: offer });
            break;
          }
          case "offer": {
            const stream = await getMic();
            if (!stream) return send({ type: "decline", from: myId });
            const peer = makePeer(stream);
            await peer.setRemoteDescription(msg.sdp);
            for (const c of pendingIce.current.splice(0)) await peer.addIceCandidate(c);
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            send({ type: "answer", from: myId, sdp: answer });
            break;
          }
          case "answer":
            await pc.current?.setRemoteDescription(msg.sdp);
            for (const c of pendingIce.current.splice(0)) await pc.current?.addIceCandidate(c);
            break;
          case "ice":
            if (pc.current?.remoteDescription) await pc.current.addIceCandidate(msg.candidate);
            else pendingIce.current.push(msg.candidate);
            break;
        }
      });
      ch.subscribe();
      channel.current = ch;
    }
    void join();
    return () => {
      cancelled = true;
      send({ type: "hangup", from: myId });
      teardown();
      if (channel.current) void supabase.removeChannel(channel.current);
      channel.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, myId]);

  async function request() {
    if (!(await getMic())) return;
    setPhase("requesting");
    send({ type: "request", from: myId });
  }

  async function accept() {
    if (!(await getMic())) return send({ type: "decline", from: myId });
    setPhase("connecting");
    send({ type: "accept", from: myId });
  }

  function hangUp() {
    send({ type: "hangup", from: myId });
    teardown();
  }

  function toggleMute() {
    const next = !muted;
    mic.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
  }

  const btn = "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium";
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-sm">
      <audio ref={audio} autoPlay />
      {phase === "idle" && (
        <button
          onClick={() => void request()}
          className={`${btn} border border-border hover:bg-accent`}
        >
          <Phone className="h-4 w-4" /> Voice chat with {opponentName}
        </button>
      )}
      {phase === "requesting" && (
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Asking {opponentName}…
          </span>
          <button onClick={hangUp} className={`${btn} text-muted-foreground hover:bg-accent`}>
            Cancel
          </button>
        </div>
      )}
      {phase === "incoming" && (
        <div className="space-y-2">
          <p>{opponentName} wants to voice chat.</p>
          <div className="flex gap-2">
            <button
              onClick={() => void accept()}
              className={`${btn} bg-primary text-primary-foreground`}
            >
              <Phone className="h-4 w-4" /> Accept
            </button>
            <button
              onClick={() => {
                send({ type: "decline", from: myId });
                setPhase("idle");
              }}
              className={`${btn} border border-border hover:bg-accent`}
            >
              Decline
            </button>
          </div>
        </div>
      )}
      {(phase === "connecting" || phase === "live") && (
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            {phase === "live" ? (
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            ) : (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {phase === "live" ? `Talking with ${opponentName}` : "Connecting…"}
          </span>
          <div className="flex gap-1">
            <button
              onClick={toggleMute}
              aria-label={muted ? "Unmute" : "Mute"}
              className={`${btn} border border-border hover:bg-accent`}
            >
              {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
            <button
              onClick={hangUp}
              aria-label="Hang up"
              className={`${btn} bg-destructive text-destructive-foreground`}
            >
              <PhoneOff className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
