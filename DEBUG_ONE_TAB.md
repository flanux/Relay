# 🐛 DEBUGGING: Why Only One Tab?

## What Your Console Shows:

```
🎯 Source activated: pptx-1 (was: pptx-1)
```

**This means:** You only have ONE source (pptx-1), and it's switching to itself!

---

## ✅ What SHOULD Happen:

### Step 1: Upload Slides
Console should show:
```
📌 Source registered: pptx-1 (pptx)
🔍 addSourceTab called: {sourceId: 'pptx-1', ...}
✅ Tab added: pptx-1, total tabs: 1
```
**Result:** ONE tab appears: `[📊 Presentation]`

### Step 2: Start Screen Share
Console should show:
```
✅ Screen share started successfully!
📌 Source registered: screen-1 (screen)
🔍 addSourceTab called: {sourceId: 'screen-1', ...}
✅ Tab added: screen-1, total tabs: 2
```
**Result:** TWO tabs appear: `[📊 Presentation] [🖥️ Screen Share]`

### Step 3: Switch Between Them
Click screen tab:
```
🖱️ Tab clicked: screen-1
🎯 Source activated: screen-1 (was: pptx-1)
🎨 Rendering source: screen-1 (screen)
📺 Showing screen share
```

Click presentation tab:
```
🖱️ Tab clicked: pptx-1
🎯 Source activated: pptx-1 (was: screen-1)  
🎨 Rendering source: pptx-1 (pptx)
📊 Showing PPTX slides
```

---

## 🚨 What's Probably Wrong:

### Issue #1: Did You Actually Start Screen Share?
**Check:** Did you click "Start Sharing" button AND select a screen?

**Your console shows:** Only pptx-1 switching to itself
**This means:** Screen share was never registered as a source!

**To Fix:**
1. Upload slides (you already did this ✅)
2. Click "Start Sharing" button
3. Select a screen/window
4. **Now you should have 2 tabs!**

### Issue #2: Screen Share Failed
**If you DID click "Start Sharing" but still only see one tab:**

Check console for:
```
💥 Screen share failed!
⚠️ Screen sharing requires HTTPS or localhost!
```

**Solution:** Make sure you're on `localhost:8000`, not IP address!

---

## 🧪 Exact Test Steps:

### Start Fresh:
1. Close all tabs
2. `python3 server.py`
3. Browser opens `localhost:8000`
4. Create room

### Add BOTH Sources:
1. **Click "📊 Upload Slides"** in header
2. Select 2-3 images
3. **Wait for:** "✅ Loaded X slide(s)" notification
4. **Check:** Do you see ONE tab? `[📊 Presentation (3 slides)]`
5. **Now click "Start Sharing"** button (below header)
6. Select a screen/window
7. **Wait for:** "Screen sharing started" notification
8. **Check:** Do you see TWO tabs now? `[📊 Presentation] [🖥️ Screen Share]`

### Test Switching:
1. **Click on "📊 Presentation" tab**
   - Should show slides
   - Console: `🎯 Source activated: pptx-1`
   
2. **Click on "🖥️ Screen Share" tab**
   - Should show video
   - Console: `🎯 Source activated: screen-1`

3. **Press Alt+1**
   - Should show slides
   
4. **Press Alt+2**
   - Should show video

---

## 📊 What To Check:

### In Console (F12):
```javascript
// Check what sources exist:
app.sourceManager.getAllSources()
// Should return array with 2 items if both are registered

// Check active source:
app.sourceManager.getActiveSource()
// Should show which one is active

// Count tabs:
document.querySelectorAll('.source-tab').length
// Should be 2 if both sources registered
```

---

## 💡 My Guess:

**You uploaded slides ✅**
**But didn't start screen share ❌**

That's why you only see ONE tab, and it keeps switching to itself!

**Solution:** Actually click "Start Sharing" button and share your screen!

---

## 🔧 About "Removing Old PPTX":

You asked about this. Here's what it does:

**Scenario:** You upload slides, then upload DIFFERENT slides

**Without removal:**
- First upload: Creates pptx-1
- Second upload: Tries to create pptx-1 again (same ID)
- Result: Duplicate prevention kicks in, title updates but tab stays same

**With removal:**
- First upload: Creates pptx-1
- Second upload: Removes pptx-1, creates NEW pptx-1
- Result: Tab updates cleanly

**This does NOT affect switching!** The removal only happens when you RE-UPLOAD slides, not when you switch tabs!

---

## 🎯 Bottom Line:

**You need BOTH sources registered:**
1. ✅ PPTX (you have this)
2. ❌ Screen share (you probably don't have this)

**Start screen sharing, and you'll get the second tab!** 🚀

Then switching will work properly!
