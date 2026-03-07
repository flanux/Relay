# Relay - Testing Checklist

## ✅ Pre-Flight Check

1. **Extract the zip**
2. **Install dependency:** `pip install aiohttp`
3. **Start server:** `python3 server.py`
4. **Note the IP shown in terminal** (e.g., http://192.168.1.23:8000)

---

## 🧪 Test Scenarios

### Test 1: Basic Connection
- [ ] Host opens browser to IP shown
- [ ] Host clicks "Create Room"
- [ ] Room code displays (e.g., room-abc123)
- [ ] Participant opens same IP on phone/laptop
- [ ] Participant enters code → Joins
- [ ] Participant count shows 1

**Expected:** Both devices connected, count updates

---

### Test 2: QR Code Join
- [ ] Host clicks "QR" button
- [ ] QR code displays (black squares on white)
- [ ] Participant clicks "Scan QR Code"
- [ ] Camera opens (allow permission)
- [ ] Point at host's QR
- [ ] Room code auto-fills
- [ ] Click Join → Success

**Expected:** QR scan auto-joins room

---

### Test 3: Screen Sharing
- [ ] Host clicks "Start Sharing"
- [ ] Browser asks permission → Allow
- [ ] Select window/tab → Share
- [ ] Button changes to "Stop Sharing"
- [ ] Participant sees live screen
- [ ] Participant clicks "Save This Slide"
- [ ] Slide appears in gallery

**Expected:** Live screen visible, slides save

---

### Test 4: File Sharing
- [ ] Host drops file in "Share Files" zone
- [ ] File appears in host's list
- [ ] Participant sees file in Files tab
- [ ] File count updates

**Expected:** Files sync instantly

---

### Test 5: Polls
- [ ] Host types poll question
- [ ] Host adds 3 options
- [ ] Host clicks "Start"
- [ ] Participant opens Polls tab
- [ ] Participant votes
- [ ] Host sees vote count update
- [ ] Host clicks "End Poll"

**Expected:** Votes sync in real-time

---

### Test 6: Notes
- [ ] Host clicks "Notes" button
- [ ] Panel opens
- [ ] Host types text
- [ ] Participant clicks "Notes"
- [ ] Participant sees same text
- [ ] Host edits → Participant updates

**Expected:** Notes sync within 1 second

---

### Test 7: Chat
- [ ] Participant opens Chat tab
- [ ] Types message → Send
- [ ] Host sees message (if host has chat open)
- [ ] Host replies
- [ ] Participant sees reply

**Expected:** Messages appear instantly

---

### Test 8: Mobile UI
- [ ] Open on phone
- [ ] Join room
- [ ] Gallery section collapsed (60px height)
- [ ] Tap header → Expands
- [ ] Tap again → Collapses
- [ ] Rotate to landscape
- [ ] Slide viewer full screen

**Expected:** Mobile-friendly, collapsible panels

---

## 🐛 Common Issues

### Issue: Participant count stays 0
**Debug:**
```javascript
// Paste in browser console (F12):
app.p2p.dataChannels.size
```
**Fix:** If 0, restart server + hard refresh both devices

---

### Issue: "QR library not loaded"
**Fix:** Check `lib/qrcode.min.js` exists (376 KB file)

---

### Issue: Screen share black/blank
**Fix:** 
- Try different window/tab
- Chrome works best
- Check browser console for errors

---

### Issue: Notes not syncing
**Debug:**
```javascript
// On host:
app.notesManager.isHost  // Should be true

// On participant:
app.notesManager.isHost  // Should be false
```

---

## 📊 Success Criteria

- ✅ Host and participant connect (count > 0)
- ✅ QR code generates and scans
- ✅ Screen sharing displays on participant
- ✅ Files transfer successfully
- ✅ Polls work end-to-end
- ✅ Notes sync in real-time
- ✅ Mobile UI is usable
- ✅ No console errors (F12)

---

## 🎯 Demo Script (For Presentation)

1. **Setup (30 sec):**
   - "This is Relay, an offline collaboration tool"
   - Show server starting
   - Show QR code on screen

2. **Join Demo (30 sec):**
   - Participant scans QR with phone
   - "Anyone can join with a scan"

3. **Screen Share (60 sec):**
   - Start sharing slides/code
   - "Students in back row can capture everything"
   - Show auto-capture toggle

4. **Features (60 sec):**
   - Create quick poll
   - Share a file
   - Show notes panel
   - "All in real-time, no internet"

5. **Closing:**
   - "Built by a backbencher, for backbenchers"
   - Show GitHub link

**Total: 3 minutes**

---

Good luck! 🚀
