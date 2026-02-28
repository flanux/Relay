<?php
// core/storage.php - Handles all JSON file operations

class Storage {
    private $dataDir;
    
    public function __construct() {
        // Set data directory relative to this file
        $this->dataDir = __DIR__ . '/../data/rooms/';
        
        // Ensure data directory exists
        if (!file_exists($this->dataDir)) {
            mkdir($this->dataDir, 0777, true);
        }
    }
    
    // Create a new room with initial structure
    public function createRoom($roomId) {
        $roomPath = $this->dataDir . $roomId;
        
        // Check if room already exists
        if (file_exists($roomPath)) {
            return false;
        }
        
        // Create room directory
        mkdir($roomPath, 0777, true);
        mkdir($roomPath . '/files', 0777, true);
        
        // Initialize state.json
        $initialState = array(
            'roomId' => $roomId,
            'created' => time(),
            'participants' => array(),
            'notes' => '',
            'polls' => array()
        );
        file_put_contents(
            $roomPath . '/state.json',
            json_encode($initialState, JSON_PRETTY_PRINT)
        );
        
        // Initialize events.json
        $initialEvents = array();
        file_put_contents(
            $roomPath . '/events.json',
            json_encode($initialEvents, JSON_PRETTY_PRINT)
        );
        
        return true;
    }
    
    // Check if room exists
    public function roomExists($roomId) {
        return file_exists($this->dataDir . $roomId . '/state.json');
    }
    
    // Get room state
    public function getRoomState($roomId) {
        if (!$this->roomExists($roomId)) {
            return null;
        }
        
        $statePath = $this->dataDir . $roomId . '/state.json';
        $content = file_get_contents($statePath);
        return json_decode($content, true);
    }
    
    // Update room state
    public function updateRoomState($roomId, $updates) {
        if (!$this->roomExists($roomId)) {
            return false;
        }
        
        $statePath = $this->dataDir . $roomId . '/state.json';
        $state = $this->getRoomState($roomId);
        
        // Merge updates into existing state
        $state = array_merge($state, $updates);
        
        file_put_contents(
            $statePath,
            json_encode($state, JSON_PRETTY_PRINT)
        );
        
        return true;
    }
    
    // Get all events
    public function getEvents($roomId) {
        if (!$this->roomExists($roomId)) {
            return null;
        }
        
        $eventsPath = $this->dataDir . $roomId . '/events.json';
        $content = file_get_contents($eventsPath);
        return json_decode($content, true);
    }
    
    // Get events after a specific event ID
    public function getEventsAfter($roomId, $afterId) {
        $allEvents = $this->getEvents($roomId);
        
        if ($allEvents === null) {
            return null;
        }
        
        // Filter events with ID greater than afterId
        $filtered = array_filter($allEvents, function($event) use ($afterId) {
            return $event['id'] > $afterId;
        });
        
        // Re-index array to start from 0
        return array_values($filtered);
    }
    
    // Append a new event
    public function appendEvent($roomId, $type, $data) {
        if (!$this->roomExists($roomId)) {
            return false;
        }
        
        $eventsPath = $this->dataDir . $roomId . '/events.json';
        $events = $this->getEvents($roomId);
        
        // Generate new event ID
        $newId = count($events) > 0 ? $events[count($events) - 1]['id'] + 1 : 1;
        
        // Create new event
        $newEvent = array(
            'id' => $newId,
            'type' => $type,
            'data' => $data,
            'timestamp' => time()
        );
        
        // Append to events array
        $events[] = $newEvent;
        
        // Save back to file
        file_put_contents(
            $eventsPath,
            json_encode($events, JSON_PRETTY_PRINT)
        );
        
        return $newEvent;
    }
    
    // Delete a room (cleanup)
    public function deleteRoom($roomId) {
        if (!$this->roomExists($roomId)) {
            return false;
        }
        
        $roomPath = $this->dataDir . $roomId;
        
        // Delete all files in files directory
        $filesDir = $roomPath . '/files';
        if (file_exists($filesDir)) {
            $files = scandir($filesDir);
            foreach ($files as $file) {
                if ($file != '.' && $file != '..') {
                    unlink($filesDir . '/' . $file);
                }
            }
            rmdir($filesDir);
        }
        
        // Delete JSON files
        if (file_exists($roomPath . '/state.json')) {
            unlink($roomPath . '/state.json');
        }
        if (file_exists($roomPath . '/events.json')) {
            unlink($roomPath . '/events.json');
        }
        
        // Delete room directory
        rmdir($roomPath);
        
        return true;
    }
}