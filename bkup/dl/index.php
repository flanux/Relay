<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LAN Collaboration Hub</title>
    <link rel="stylesheet" href="public/style.css">
</head>
<body>
    <div class="container">
        <h1>LAN Collaboration Hub</h1>
        <p>Share files and notes instantly over your local network</p>
        
        <div class="card">
            <h2>Create a Room</h2>
            <p>Start a new session as a teacher</p>
            <label>
                Your Name:
                <input type="text" id="createUsername" placeholder="Enter your name" value="Teacher">
            </label>
            <button onclick="createRoom()">Create Room</button>
        </div>
        
        <div class="card">
            <h2>Join a Room</h2>
            <p>Enter a room code to join as a student</p>
            <label>
                Your Name:
                <input type="text" id="joinUsername" placeholder="Enter your name" value="Student">
            </label>
            <label>
                Room Code:
                <input type="text" id="roomCode" placeholder="e.g. ABC123" maxlength="6">
            </label>
            <label>
                Role:
                <select id="joinRole">
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                </select>
            </label>
            <button onclick="joinRoom()">Join Room</button>
        </div>
        
        <div id="status"></div>
    </div>
    
    <script>
        async function createRoom() {
            const username = document.getElementById('createUsername').value.trim();
            
            if (!username) {
                alert('Please enter your name');
                return;
            }
            
            const status = document.getElementById('status');
            status.textContent = 'Creating room...';
            
            try {
                const formData = new FormData();
                formData.append('action', 'create_room');
                formData.append('role', 'teacher');
                
                const response = await fetch('api.php', {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                
                if (data.success) {
                    localStorage.setItem('username', username);
                    localStorage.setItem('role', 'teacher');
                    
                    const joinFormData = new FormData();
                    joinFormData.append('action', 'join_room');
                    joinFormData.append('roomId', data.roomId);
                    joinFormData.append('username', username);
                    joinFormData.append('role', 'teacher');
                    
                    await fetch('api.php', {
                        method: 'POST',
                        body: joinFormData
                    });
                    
                    window.location.href = `room.php?id=${data.roomId}`;
                } else {
                    status.textContent = 'Error: ' + data.error;
                }
            } catch (error) {
                status.textContent = 'Error: ' + error.message;
            }
        }
        
        async function joinRoom() {
            const username = document.getElementById('joinUsername').value.trim();
            const roomCode = document.getElementById('roomCode').value.trim().toUpperCase();
            const role = document.getElementById('joinRole').value;
            
            if (!username) {
                alert('Please enter your name');
                return;
            }
            
            if (!roomCode || roomCode.length !== 6) {
                alert('Please enter a valid 6-character room code');
                return;
            }
            
            const status = document.getElementById('status');
            status.textContent = 'Joining room...';
            
            try {
                const formData = new FormData();
                formData.append('action', 'join_room');
                formData.append('roomId', roomCode);
                formData.append('username', username);
                formData.append('role', role);
                
                const response = await fetch('api.php', {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                
                if (data.success) {
                    localStorage.setItem('username', username);
                    localStorage.setItem('role', role);
                    
                    window.location.href = `room.php?id=${roomCode}`;
                } else {
                    status.textContent = 'Error: ' + data.error;
                }
            } catch (error) {
                status.textContent = 'Error: ' + error.message;
            }
        }
        
        document.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                if (document.activeElement.id === 'roomCode' || 
                    document.activeElement.id === 'joinUsername') {
                    joinRoom();
                } else if (document.activeElement.id === 'createUsername') {
                    createRoom();
                }
            }
        });
    </script>
</body>
</html>