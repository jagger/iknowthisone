# TODO

## Email — Host Link via Resend ⚠️ Needs Setup

The host link flow currently falls back to `mailto:` (opens the device's mail app). The plan is to send host links server-side via the Resend API. This requires the following steps:

### 1. Set up Resend account and domain

1. Sign up at https://resend.com
2. Go to **Domains** → **Add Domain** → enter `iknowthisone.jagger.dev`
3. Add the DNS records Resend shows you (SPF, DKIM, DMARC) at your DNS provider
4. Wait for verification (can take a few minutes)
5. Create an API key under **API Keys** → copy it

### 2. Install the Resend SDK

```bash
cd functions
npm install resend
```

### 3. Store the API key as a Firebase secret

```bash
firebase functions:secrets:set RESEND_API_KEY
# Paste your API key when prompted
```

### 4. Code changes needed

**`functions/src/index.ts` — `createRoom` function:**

```typescript
import { Resend } from 'resend'
import { defineSecret } from 'firebase-functions/params'

const resendKey = defineSecret('RESEND_API_KEY')

export const createRoom = onCall({ secrets: [resendKey] }, async (request) => {
  // ... existing room creation logic ...

  const { email } = request.data as { email?: string }
  if (email) {
    const resend = new Resend(resendKey.value())
    const hostLink = `https://iknowthisone.jagger.dev/join/${roomCode}?hostToken=${hostToken}`
    await resend.emails.send({
      from: 'I Know This One <noreply@iknowthisone.jagger.dev>',
      to: email,
      subject: 'Your host link for I Know This One',
      text: `You created a room! Join as host here:\n\n${hostLink}\n\nRoom code: ${roomCode}`,
    })
  }

  return { roomCode }  // hostToken NOT returned to client
})
```

**`src/components/auth/NameScreen.tsx` — `handleCreate`:**
- Pass `{ email }` in the `createRoom({})` call (already structured to accept it)
- Remove the `mailto:` fallback
- Remove `data.hostToken` usage (server handles it)

### 5. Verify

1. Create a room with an email address → email should arrive within seconds
2. Click the link in the email → Join screen should auto-fill room code and claim host role
3. Create a room without email → first player to join becomes host automatically
