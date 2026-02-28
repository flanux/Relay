
class App {
    constructor(roomId, username, role) {
        this.roomId = roomId;
        this.username = username;
        this.role = role;
        this.lastEventId = 0;
        this.isPolling = false;
        this.pollInterval = 2000; 
        this.eventHandlers = {};
        this.connected = false;
    }
    
    async start() {
        console.log('Starting app for room:', this.roomId);
        
        this.setupEventHandlers();
        
        await this.loadRoomState();
        
        this.startPolling();
        
        console.log('App started successfully');
    }
    
    setupEventHandlers() {
        this.on('room_created', (data) => {
            console.log('Room created:', data);
            this.log('Room created by ' + data.role);
        });
        
        this.on('user_joined', (data) => {
            console.log('User joined:', data);
            this.log(data.username + ' (' + data.role + ') joined the room');
            this.updateParticipantCount();
        });
        
        this.on('test_message', (data) => {
            console.log('Test message received:', data);
            this.log(data.username + ': ' + data.message);
        });
    }
    
    async loadRoomState() {
        try {
            const response = await fetch(`api.php?action=get_room&roomId=${this.roomId}`);
            const data = await response.json();
            
            if (data.success) {
                console.log('Room state loaded:', data.room);
                this.updateParticipantCount(data.room.participants.length);
                
                await this.loadPastEvents();
            } else {
                console.error('Failed to load room state:', data.error);
                alert('Error: ' + data.error);
                window.location.href = 'index.php';
            }
        } catch (error) {
            console.error('Error loading room state:', error);
        }
    }
    
    async loadPastEvents() {
        try {
            const response = await fetch(`api.php?action=get_events&roomId=${this.roomId}`);
            const data = await response.json();
            
            if (data.success && data.events) {
                console.log('Loading past events:', data.events.length);
                
                data.events.forEach(event => {
                    // Update last event ID
                    if (event.id > this.lastEventId) {
                        this.lastEventId = event.id;
                    }
                    
                    this.emitLocal(event.type, event.data);
                });
            }
        } catch (error) {
            console.error('Error loading past events:', error);
        }
    }
    
    startPolling() {
        if (this.isPolling) return;
        
        this.isPolling = true;
        this.poll();
    }
    
    stopPolling() {
        this.isPolling = false;
    }
    
    async poll() {
        if (!this.isPolling) return;
        
        try {
            const response = await fetch(
                `api.php?action=poll&roomId=${this.roomId}&after=${this.lastEventId}`
            );
            const data = await response.json();
            
            if (data.success) {
                if (!this.connected) {
                    this.connected = true;
                    this.updateConnectionStatus(true);
                }
                
                if (data.events && data.events.length > 0) {
                    console.log('Received events:', data.events);
                    
                    data.events.forEach(event => {
                        if (event.id > this.lastEventId) {
                            this.lastEventId = event.id;
                        }
                        
                        this.emitLocal(event.type, event.data);
                    });
                    
                    this.updateParticipantCount();
                }
            } else {
                console.error('Poll error:', data.error);
                this.connected = false;
                this.updateConnectionStatus(false);
            }
        } catch (error) {
            console.error('Poll request failed:', error);
            this.connected = false;
            this.updateConnectionStatus(false);
        }
        
        setTimeout(() => this.poll(), this.pollInterval);
    }
    
    async emit(eventType, eventData) {
        try {
            const formData = new FormData();
            formData.append('action', 'emit');
            formData.append('roomId', this.roomId);
            formData.append('type', eventType);
            formData.append('data', JSON.stringify(eventData));
            
            const response = await fetch('api.php', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                console.log('Event emitted:', eventType, eventData);
            } else {
                console.error('Failed to emit event:', data.error);
            }
        } catch (error) {
            console.error('Error emitting event:', error);
        }
    }
    
    emitLocal(eventType, eventData) {
        if (this.eventHandlers[eventType]) {
            this.eventHandlers[eventType].forEach(handler => {
                handler(eventData);
            });
        }
    }
    
    on(eventType, handler) {
        if (!this.eventHandlers[eventType]) {
            this.eventHandlers[eventType] = [];
        }
        this.eventHandlers[eventType].push(handler);
    }
    
    updateConnectionStatus(connected) {
        const statusDot = document.getElementById('connectionStatus');
        if (statusDot) {
            statusDot.className = 'status-dot ' + (connected ? 'connected' : 'disconnected');
            statusDot.title = connected ? 'Connected' : 'Disconnected';
        }
    }
    
    async updateParticipantCount(count) {
        if (count === undefined) {
            try {
                const response = await fetch(`api.php?action=get_room&roomId=${this.roomId}`);
                const data = await response.json();
                
                if (data.success) {
                    count = data.room.participants.length;
                }
            } catch (error) {
                console.error('Error fetching participant count:', error);
                return;
            }
        }
        
        const countElement = document.getElementById('participantCount');
        if (countElement) {
            countElement.textContent = count + ' participant' + (count !== 1 ? 's' : '');
        }
    }
    
    log(message) {
        const eventLog = document.getElementById('eventLog');
        if (eventLog) {
            const entry = document.createElement('div');
            entry.className = 'log-entry';
            
            const timestamp = new Date().toLocaleTimeString();
            entry.textContent = `[${timestamp}] ${message}`;
            
            eventLog.appendChild(entry);
            
            eventLog.scrollTop = eventLog.scrollHeight;
            
            while (eventLog.children.length > 50) {
                eventLog.removeChild(eventLog.firstChild);
            }
        }
    }
}