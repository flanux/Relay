# 🚀 Quick Start - PowerPoint & Overlay Features

## ⚡ Installation (30 seconds)

Your project is ready to go! All files have been created following the architecture guardrails.

### Files Added:
```
Relay-main/
├── modules/
│   ├── pptx.js          ← PowerPoint upload & presentation
│   └── overlay.js       ← Floating control panel
├── PPTX_FEATURE.md      ← Full documentation
└── INTEGRATION_GUIDE.md ← This file
```

### Files Modified:
```
app.js       ← Added 3 new message handlers + initialization
index.html   ← Added 2 script includes
```

### Files UNCHANGED (Zero breakage risk):
```
✅ modules/webrtc.js   (P2P networking - untouched)
✅ modules/storage.js  (Storage layer - untouched)
✅ modules/slides.js   (Screen sharing - untouched)
✅ modules/polls.js    (Polls - untouched)
✅ modules/notes.js    (Notes - untouched)
✅ server.py           (Backend - untouched)
```

---

## 🧪 Testing (5 minutes)

### 1. Start the Server
```bash
cd Relay-main
python3 server.py
```

### 2. Open Two Browser Windows

**Window 1 - Host:**
- Go to `http://localhost:8080`
- Click "Create Room (Host)"
- You should see the new "📊 Upload Presentation" section

**Window 2 - Participant:**
- Go to `http://localhost:8080`
- Enter room code from Window 1
- Click "Join as Participant"

### 3. Test PowerPoint Upload

**On Host (Window 1):**
1. Find some test images (PNG/JPG) - even screenshots work
2. Click "Choose PDF/Images"
3. Upload 2-3 images
4. ✅ Should see: "✅ Loaded X slide(s)"
5. ✅ Should see: Presentation controls appear
6. Click "Next ➡️"
7. Press arrow keys to navigate

**On Participant (Window 2):**
1. ✅ Should see: Notification "📊 Presentation loaded"
2. ✅ Should see: First slide appears automatically
3. ✅ Should see: Slides change when host navigates
4. Test keyboard controls (if host role):
   - `→` or `Space` = Next slide
   - `←` = Previous slide
   - `Esc` = End presentation

### 4. Test Overlay Controls

**On Host (Window 1):**
1. Click "Start Sharing" button
2. Select a screen/window to share
3. ✅ Should see: Floating overlay panel appears
4. Try each button:
   - 📊 Create Poll → Should switch to polls tab
   - 📝 Toggle Notes → Should show/hide notes
   - 📎 Share File → Should open file picker
   - ⏭️ Next Slide → Should advance (if presentation active)
5. Drag the overlay header → Should move around

**On Participant (Window 2):**
- ✅ Should see: Screen share frames from host
- No overlay needed on participant side

---

## ✅ Validation Checklist

Run through this before deploying:

### Core Features (Must Still Work)
- [ ] Create room generates QR code
- [ ] Join room with code works
- [ ] Screen sharing broadcasts frames
- [ ] Polls sync between host and participants
- [ ] Notes sync properly
- [ ] File sharing works
- [ ] Chat messages appear
- [ ] Participant list updates

### New Features
- [ ] Upload section appears on host screen
- [ ] Can select image files
- [ ] Slides process and load correctly
- [ ] Presentation controls appear
- [ ] Keyboard navigation works (arrow keys, space, esc)
- [ ] Slides broadcast to participants
- [ ] Participants see slides automatically
- [ ] Overlay appears when screen sharing starts
- [ ] Overlay buttons trigger correct actions
- [ ] Overlay can be dragged around
- [ ] Overlay hides when screen sharing stops

### Edge Cases
- [ ] Upload with no files selected → No crash
- [ ] Upload invalid file type → Shows error, no crash
- [ ] End presentation → Cleans up properly
- [ ] Participant joins mid-presentation → Sees current slide
- [ ] Host closes room during presentation → Participants notified

---

## 🐛 If Something Breaks

### Step 1: Check Browser Console
Press `F12` → Console tab → Look for errors

### Step 2: Verify Scripts Loaded
In browser console, type:
```javascript
console.log(window.PPTXRenderer)    // Should show: class PPTXRenderer
console.log(window.OverlayControls) // Should show: class OverlayControls
```

### Step 3: Check Feature Flags
If features aren't showing, they might be disabled:

Edit `/modules/pptx.js`:
```javascript
this.ENABLE_PPTX = true; // Make sure this is true
```

Edit `/modules/overlay.js`:
```javascript
this.ENABLE_OVERLAY = true; // Make sure this is true
```

### Step 4: Emergency Rollback

If everything is broken:

**Option A - Disable New Features:**
Set both flags to `false` (see Step 3)

**Option B - Restore Original Files:**
```bash
git checkout app.js index.html
rm modules/pptx.js modules/overlay.js
```

---

## 📱 Mobile Testing

### iOS Safari
1. Open on iPhone/iPad
2. Create/join room
3. Upload slides (host)
4. Test overlay controls (should be tappable)
5. Test keyboard appears for notes

### Android Chrome
1. Open on Android device
2. Test same flow as iOS
3. Verify touch targets are large enough (44px min)

---

## 🎯 Common Issues & Fixes

### Issue: "Upload Presentation" section missing
**Fix:** You're on participant view. Only hosts see upload section.

### Issue: Slides not syncing to participants
**Fix:**
1. Check WebRTC connection is active (participant count > 0)
2. Check browser console for `pptx_loaded` message
3. Verify both host and participant loaded `pptx.js`

### Issue: Overlay not appearing
**Fix:**
1. Must start screen sharing first
2. Check `ENABLE_OVERLAY` flag is true
3. Verify `overlay.js` loaded (see Step 2 above)

### Issue: Files too large / page crashes
**Fix:**
1. Use JPEG instead of PNG (smaller)
2. Limit to 20 slides max
3. Check browser console for memory warnings

### Issue: Keyboard shortcuts not working
**Fix:**
1. Click on the page to focus it
2. Make sure presentation mode is active
3. Check browser console for errors

---

## 🚢 Deployment Checklist

Before going live:

### Production Readiness
- [ ] Test on actual classroom network (LAN)
- [ ] Test with real slide deck (20-30 slides)
- [ ] Test with 5+ participants simultaneously
- [ ] Test on mobile devices (iOS + Android)
- [ ] Test with projector connected
- [ ] Verify no console errors
- [ ] Verify memory usage stable over 10 minutes

### Performance Checks
- [ ] Page load time < 2 seconds
- [ ] Slide transitions smooth
- [ ] No lag when creating polls during presentation
- [ ] Screen sharing framerate acceptable (2fps is fine)

### User Experience
- [ ] Instructions clear for teachers
- [ ] Upload workflow intuitive
- [ ] Overlay not blocking important content
- [ ] Mobile view usable
- [ ] Error messages helpful

---

## 💡 Quick Demo Script

Use this to demonstrate the features:

**[Open browser]**
"Let me show you Relay's new presentation features..."

**[Create room]**
"First, I'll create a room as the host."

**[Show upload section]**
"See this new Upload Presentation section? I can load my slides directly."

**[Upload 3 images]**
"I'll upload a few sample slides... There we go, loaded 3 slides."

**[Navigate with keyboard]**
"Now I can control them with arrow keys or these buttons."

**[Start screen sharing]**
"When I start screen sharing..."

**[Point to overlay]**
"...this control panel appears! I can create polls, share notes, all without stopping my presentation."

**[Click Create Poll]**
"See? One click and I'm in the polls tab. Still sharing my screen!"

**[On participant window]**
"And here's the student view - they see my slides automatically, no projector needed."

---

## 🎓 Teacher Training Points

When explaining to teachers:

### Key Benefits
1. **No more switching apps** - Everything in one place
2. **Works without projector** - Students see directly on devices
3. **Interactive during presentation** - Create polls without stopping
4. **Simple upload** - Just export PowerPoint as images

### Common Teacher Questions

**Q: Can I use my existing PowerPoint files?**
A: Yes! Just export as images first (File → Export → PNG)

**Q: What if the projector is broken?**
A: Perfect! Every student sees slides on their own device

**Q: Can I create polls while presenting?**
A: Yes! Use the overlay panel or keyboard shortcuts

**Q: Do I need internet?**
A: No! Works on LAN only, perfect for offline classrooms

---

## 📊 Metrics to Track

After deployment, monitor:

- Feature adoption rate (% of rooms using slide upload)
- Average slides per presentation
- Overlay control usage frequency
- Performance (memory, CPU during presentation)
- Error rate (failed uploads, sync issues)
- User feedback (teachers & students)

---

## 🔮 Future Enhancements

Ideas for next iteration:

### Phase 2
- [ ] PDF support (requires pdf.js library)
- [ ] Slide thumbnails in sidebar
- [ ] Timer per slide
- [ ] Presenter notes (visible to host only)

### Phase 3
- [ ] Real-time annotations/drawing
- [ ] Laser pointer cursor
- [ ] Slide animations
- [ ] Export presentation with polls embedded

### Phase 4
- [ ] AI-generated quiz from slides
- [ ] Automatic slide transitions
- [ ] Student attention tracking
- [ ] Slide library/templates

---

## 📞 Support Resources

- **Documentation:** `PPTX_FEATURE.md`
- **Architecture:** See guardrails documents
- **Issues:** Check browser console first
- **Community:** [Add forum/support link]

---

**Ready to Test!** 🎉

Run `python3 server.py` and open two browser windows to get started.

If you hit any issues, check the troubleshooting section above or review the validation checklist.

Good luck! 🚀
