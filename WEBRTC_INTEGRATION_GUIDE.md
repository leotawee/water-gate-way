# WebRTC Player - Integration Guide

## Component: `<WebRTCPlayer />`

### Location
`src/components/WebRTCPlayer.tsx`

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `signalingUrl` | `string` | `"[PI_SIGNALING_URL]"` | Backend signaling endpoint (e.g., `http://192.168.1.100:8000/stream`) |
| `stunServer` | `string` | `"[STUN_SERVER_URL]"` | STUN server for NAT traversal (e.g., `stun:stun.l.google.com:19302`) |
| `camId` | `number` | `1` | Camera identifier for display |

### Usage Example

```tsx
import WebRTCPlayer from "@/components/WebRTCPlayer";

function Dashboard() {
  return (
    <div className="camera-feed">
      <WebRTCPlayer
        signalingUrl="http://192.168.1.100:8000/stream"
        stunServer="stun:stun.l.google.com:19302"
        camId={1}
      />
    </div>
  );
}
```

## Backend Requirements

The backend signaling server must:

1. **Accept HTTP POST** at the signaling URL with:
   ```json
   {
     "sdp": "v=0\r\no-... (SDP offer)",
     "type": "offer"
   }
   ```

2. **Return SDP Answer** in JSON format:
   ```json
   {
     "sdp": "v=0\r\no-... (SDP answer)",
     "type": "answer"
   }
   ```

3. **Handle ICE Candidates** internally (trickle ICE not implemented yet)

## Debugging

The component logs all connection states to the browser console:

- `🎥 Camera X: Initializing WebRTC connection...`
- `🧊 ICE State → checking/connected/completed/failed`
- `📡 Signaling State → stable/have-local-offer/have-remote-offer`
- `🔗 Peer Connection State → connecting/connected/failed/disconnected`
- `📹 Camera X: Received video track`
- `✅ Camera X: Video stream attached to element`

**Common Issues:**
- `ICE failed` → Check STUN server URL or network restrictions
- `HTTP 404` → Backend signaling endpoint not reachable
- `Connection failed` → Backend not returning valid SDP answer

## Testing Checklist

- [ ] Replace `[PI_SIGNALING_URL]` with actual Raspberry Pi IP
- [ ] Confirm STUN server is accessible
- [ ] Verify backend returns HTTP 200 with valid SDP
- [ ] Check browser console for connection states
- [ ] Confirm video stream appears in UI

## Architecture

```
┌─────────────────┐         POST SDP Offer         ┌──────────────────┐
│  Next.js App    │ ────────────────────────────> │  Raspberry Pi    │
│  (Browser)      │                                 │  (C++ Backend)   │
│                 │ <──────────────────────────── │                  │
│                 │    Return SDP Answer           │                  │
└─────────────────┘                                 └──────────────────┘
        │                                                   │
        │ Create PeerConnection                            │
        │ setLocalDescription(offer)                       │
        │                                                   │
        │ ontrack → srcObject = stream                     │
        │                                                   │
        ▼                                                   ▼
   <video> element                              WebRTC NativeStreamer
```

---

**Status:** Ready for Hardware Team Integration 🔧
