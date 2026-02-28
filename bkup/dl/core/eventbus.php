<?php
// core/eventbus.php - Handles event broadcasting and retrieval

require_once __DIR__ . '/storage.php';

class EventBus {
    private $storage;
    
    public function __construct() {
        $this->storage = new Storage();
    }
    
    // Emit an event (append to event log)
    public function emit($roomId, $eventType, $eventData) {
        if (!$this->storage->roomExists($roomId)) {
            return array(
                'success' => false,
                'error' => 'Room not found'
            );
        }
        
        $event = $this->storage->appendEvent($roomId, $eventType, $eventData);
        
        return array(
            'success' => true,
            'event' => $event
        );
    }
    
    // Poll for new events (get events after a specific ID)
    public function poll($roomId, $afterId = 0) {
        if (!$this->storage->roomExists($roomId)) {
            return array(
                'success' => false,
                'error' => 'Room not found'
            );
        }
        
        $events = $this->storage->getEventsAfter($roomId, $afterId);
        
        return array(
            'success' => true,
            'events' => $events
        );
    }
    
    // Get all events (for debugging or initial load)
    public function getAllEvents($roomId) {
        if (!$this->storage->roomExists($roomId)) {
            return array(
                'success' => false,
                'error' => 'Room not found'
            );
        }
        
        $events = $this->storage->getEvents($roomId);
        
        return array(
            'success' => true,
            'events' => $events
        );
    }
}