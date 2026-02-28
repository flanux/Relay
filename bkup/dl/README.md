# 🚀 LAN-Based Interactive Collaboration Hub

> **No Internet? No Problem!** A lightweight, self-hosted collaboration platform that works entirely on your local network.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PHP](https://img.shields.io/badge/PHP-7.4%2B-blue)](https://php.net)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6-yellow)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

Perfect for classrooms, offices, conferences, or anywhere you need instant collaboration without internet dependency.

---

## ✨ Features

### 🏠 **Room-Based Collaboration**
- Create public or private collaboration rooms
- Join rooms with simple room codes
- No registration or login required
- Works completely offline on LAN

### 📁 **File Sharing**
- Drag & drop file uploads
- Share any file type
- Direct peer-to-peer transfer over LAN
- No file size limits (server-dependent)
- Instant downloads for all room participants

### 🗳️ **Real-time Polls & Voting**
- Create instant polls
- Multiple choice questions
- Live result updates
- Anonymous or attributed voting
- Export results

### 🌐 **LAN-First Design**
- **Zero internet dependency**
- Works on any local network
- Lightning-fast transfers
- Private and secure
- Battery-efficient

### 💡 **Additional Features**
- Clean, intuitive interface
- Mobile-friendly responsive design
- Real-time updates (polling-based)
- Persistent rooms and data
- Easy deployment

---

## 🎯 Use Cases

| Scenario | How It Helps |
|----------|--------------|
| **Classroom** | Teachers share materials, students submit work, instant polls for quizzes |
| **Office Meetings** | Share documents, collect votes, collaborate without cloud services |
| **Conferences** | Distribute files to attendees, gather feedback, Q&A sessions |
| **Remote Areas** | Full collaboration without internet connectivity |
| **Offline Events** | Trade shows, workshops, seminars with local file sharing |
| **Privacy-First** | Keep sensitive data on your network, not the cloud |

---

## 🚀 Quick Start

### Prerequisites
- PHP 7.4 or higher
- Web server (Apache/Nginx) or PHP built-in server
- Local network (LAN/WiFi)

### Installation

#### Option 1: Using PHP Built-in Server (Quickest)

```bash
# 1. Clone the repository
git clone https://github.com/flanux/LAN-Based-Interactive-Collaboration-Hub.git
cd LAN-Based-Interactive-Collaboration-Hub

# 2. Start the server
php -S 0.0.0.0:8000

# 3. Find your local IP
# On Linux/Mac:
ip addr show | grep inet
# On Windows:
ipconfig

# 4. Share with others on your network
# Example: http://192.168.1.100:8000
```

#### Option 2: Using Apache/Nginx

```bash
# 1. Clone to your web directory
cd /var/www/html  # or your web root
git clone https://github.com/flanux/LAN-Based-Interactive-Collaboration-Hub.git collab
cd collab

# 2. Set permissions
chmod -R 755 .
chmod -R 777 data/

# 3. Access via browser
# http://your-server-ip/collab
```

#### Option 3: Docker (Coming Soon)

```bash
docker run -p 8000:80 -v $(pwd)/data:/app/data flanux/lan-collab
```

---

## 📖 How to Use

### Creating a Room

1. **Open the app** in your browser
2. **Click "Create Room"**
3. **Choose settings:**
   - Room name
   - Public or private
   - Enable/disable features (file sharing, polls)
4. **Share the room code** with participants

### Joining a Room

1. **Open the app**
2. **Enter the room code** or select from public rooms
3. **Start collaborating!**

### Sharing Files

1. **Inside a room**, go to "Files" tab
2. **Drag & drop** files or click "Upload"
3. **Files appear** instantly for all participants
4. **Anyone can download** shared files

### Creating Polls

1. **Inside a room**, go to "Polls" tab
2. **Click "Create Poll"**
3. **Enter question** and options
4. **Publish** - results update in real-time
5. **Participants vote** and see live results

---

## 🏗️ Architecture

### System Design

```
┌─────────────────────────────────────────────────┐
│              LAN Network (192.168.x.x)          │
├─────────────────────────────────────────────────┤
│                                                 │
│  📱 Device 1    📱 Device 2    💻 Device 3      │
│     ↓               ↓               ↓           │
│     └───────────────┴───────────────┘           │
│                     ↓                           │
│            🖥️  Server (PHP)                     │
│              (192.168.1.100:8000)               │
│                     ↓                           │
│         ┌───────────┴───────────┐               │
│         ↓                       ↓               │
│    📂 File Storage         🗄️ Room Data         │
│    (data/files/)          (data/rooms/)         │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Technology Stack

**Frontend:**
- Vanilla JavaScript (ES6+)
- CSS3 with modern features
- Responsive design
- No external dependencies

**Backend:**
- PHP 7.4+ (pure PHP, no frameworks)
- File-based storage (no database required)
- RESTful API design
- Stateless architecture

**Why No Database?**
- Simpler deployment
- No additional setup
- Portable (just copy the folder)
- Perfect for LAN use cases

---

## 📁 Project Structure

```
LAN-Based-Interactive-Collaboration-Hub/
├── index.php              # Landing page / room list
├── room.php               # Room interface
├── api.php                # REST API endpoints
├── core/
│   ├── Room.php           # Room management logic
│   ├── FileHandler.php    # File upload/download
│   └── PollManager.php    # Poll creation/voting
├── features/
│   ├── file-sharing.js    # File sharing frontend
│   ├── polling.js         # Polling frontend
│   └── realtime.js        # Real-time updates
├── public/
│   ├── css/
│   │   └── style.css      # Styles
│   └── js/
│       └── app.js         # Main JavaScript
├── data/
│   ├── rooms/             # Room data (JSON files)
│   └── files/             # Uploaded files
└── .user.ini              # PHP configuration
```

---

## 🔧 Configuration

### PHP Settings (`.user.ini`)

```ini
upload_max_filesize = 100M
post_max_size = 100M
max_execution_time = 300
memory_limit = 256M
```

Adjust based on your needs:
- **Larger files?** Increase `upload_max_filesize`
- **Many simultaneous users?** Increase `memory_limit`
- **Slow network?** Increase `max_execution_time`

### Application Settings

Edit `core/Config.php`:

```php
define('MAX_FILE_SIZE', 100 * 1024 * 1024);  // 100MB
define('ALLOWED_FILE_TYPES', ['*']);         // All types
define('ROOM_EXPIRY_HOURS', 24);             // Auto-delete after 24h
define('POLL_REFRESH_INTERVAL', 5000);       // 5 seconds
```

---

## 🔐 Security Features

### Built-in Security

✅ **File Upload Validation**
- File type checking
- Size limits
- Path traversal protection
- Sanitized filenames

✅ **Room Access Control**
- Optional room passwords
- Private/public room settings
- Session-based access

✅ **Input Sanitization**
- XSS protection
- SQL injection prevention (no SQL used)
- CSRF token validation

✅ **Network Security**
- LAN-only by default (not exposed to internet)
- No external API calls
- All data stays local

### Security Best Practices

```bash
# 1. Restrict file uploads
chmod 755 data/files/

# 2. Disable directory listing
# Add to .htaccess:
Options -Indexes

# 3. Limit network access
# Use firewall to restrict to LAN only
sudo ufw allow from 192.168.0.0/16 to any port 8000
```

---

## 🎨 Customization

### Themes

Create custom themes in `public/css/themes/`:

```css
/* themes/dark.css */
:root {
    --primary-color: #2c3e50;
    --secondary-color: #34495e;
    --accent-color: #3498db;
    --text-color: #ecf0f1;
    --bg-color: #1a1a1a;
}
```

### Adding Features

The modular architecture makes it easy to add features:

```php
// core/CustomFeature.php
class CustomFeature {
    public function doSomething() {
        // Your logic here
    }
}

// api.php
case 'custom-action':
    $feature = new CustomFeature();
    $result = $feature->doSomething();
    echo json_encode($result);
    break;
```

---

## 🧪 Testing

### Manual Testing

```bash
# 1. Test room creation
curl -X POST http://localhost:8000/api.php \
  -d "action=createRoom&name=TestRoom"

# 2. Test file upload
curl -X POST http://localhost:8000/api.php \
  -F "action=uploadFile" \
  -F "roomId=ROOM123" \
  -F "file=@test.pdf"

# 3. Test poll creation
curl -X POST http://localhost:8000/api.php \
  -d "action=createPoll&roomId=ROOM123&question=Test?&options[]=Yes&options[]=No"
```

### Load Testing

```bash
# Install Apache Bench
sudo apt-get install apache2-utils

# Test 100 concurrent users
ab -n 1000 -c 100 http://localhost:8000/

# Expected: Should handle 50-100 concurrent users smoothly
```

---

## 🚧 Roadmap

### Version 1.1 (Current)
- ✅ Room creation
- ✅ File sharing
- ✅ Polls & voting
- ✅ LAN support

### Version 1.2 (Planned)
- [ ] Real-time chat
- [ ] Whiteboard feature
- [ ] Screen sharing links
- [ ] Room templates

### Version 2.0 (Future)
- [ ] WebRTC peer-to-peer
- [ ] End-to-end encryption
- [ ] Mobile apps
- [ ] Docker container
- [ ] Admin dashboard

---

## 🤝 Contributing

Contributions are welcome! Here's how:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Contribution Guidelines

- Follow PSR-12 coding standards for PHP
- Use ES6+ JavaScript
- Add comments for complex logic
- Test your changes locally
- Update documentation

---

## 📜 License

MIT License - see [LICENSE](LICENSE) file for details

---

## 🙏 Acknowledgments

- Inspired by the need for offline collaboration tools
- Built with simplicity and privacy in mind
- Thanks to all contributors

---

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/flanux/LAN-Based-Interactive-Collaboration-Hub/issues)
- **Discussions:** [GitHub Discussions](https://github.com/flanux/LAN-Based-Interactive-Collaboration-Hub/discussions)

---

## 🌟 Star History

If you find this project useful, please consider giving it a star! ⭐

---

## 📊 Stats

![GitHub stars](https://img.shields.io/github/stars/flanux/LAN-Based-Interactive-Collaboration-Hub?style=social)
![GitHub forks](https://img.shields.io/github/forks/flanux/LAN-Based-Interactive-Collaboration-Hub?style=social)
![GitHub issues](https://img.shields.io/github/issues/flanux/LAN-Based-Interactive-Collaboration-Hub)
![GitHub last commit](https://img.shields.io/github/last-commit/flanux/LAN-Based-Interactive-Collaboration-Hub)

---

**Made with ❤️ for collaborative teams working offline**

*No internet? No problem. Your network, your data, your control.*
