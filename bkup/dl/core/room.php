<?php
// core/room.php - Handles room management logic

require_once __DIR__ . '/storage.php';

class RoomManager {
    private $storage;
    
    public function __construct() {
        $this->storage = new Storage();
    }
    
    // Generate a random 6-character room ID
    private function generateRoomId() {
        $characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        $roomId = '';
        
        for ($i = 0; $i < 6; $i++) {
            $roomId .= $characters[rand(0, strlen($characters) - 1)];
        }
        
        return $roomId;
    }
    
    // Create a new room
    public function createRoom($creatorRole = 'teacher') {
        // Generate unique room ID
        do {
            $roomId = $this->generateRoomId();
        } while ($this->storage->roomExists($roomId));
        
        // Create room with storage
        $success = $this->storage->createRoom($roomId);
        
        if ($success) {
            // Add creation event
            $this->storage->appendEvent($roomId, 'room_created', array(
                'roomId' => $roomId,
                'role' => $creatorRole
            ));
            
            return array(
                'success' => true,
                'roomId' => $roomId
            );
        }
        
        return array(
            'success' => false,
            'error' => 'Failed to create room'
        );
    }
    
    // Join an existing room
    public function joinRoom($roomId, $username, $role = 'student') {
        // Validate room exists
        if (!$this->storage->roomExists($roomId)) {
            return array(
                'success' => false,
                'error' => 'Room not found'
            );
        }
        
        // Get current state
        $state = $this->storage->getRoomState($roomId);
        
        // Add participant if not already in list
        $participantExists = false;
        foreach ($state['participants'] as $participant) {
            if ($participant['username'] === $username) {
                $participantExists = true;
                break;
            }
        }
        
        if (!$participantExists) {
            $state['participants'][] = array(
                'username' => $username,
                'role' => $role,
                'joinedAt' => time()
            );
            
            $this->storage->updateRoomState($roomId, array(
                'participants' => $state['participants']
            ));
            
            // Broadcast join event
            $this->storage->appendEvent($roomId, 'user_joined', array(
                'username' => $username,
                'role' => $role
            ));
        }
        
        return array(
            'success' => true,
            'roomId' => $roomId,
            'state' => $state
        );
    }
    
    // Get room info
    public function getRoomInfo($roomId) {
        if (!$this->storage->roomExists($roomId)) {
            return array(
                'success' => false,
                'error' => 'Room not found'
            );
        }
        
        $state = $this->storage->getRoomState($roomId);
        
        return array(
            'success' => true,
            'room' => $state
        );
    }
    
    // Get participants count
    public function getParticipantsCount($roomId) {
        $state = $this->storage->getRoomState($roomId);
        
        if ($state === null) {
            return 0;
        }
        
        return count($state['participants']);
    }
}