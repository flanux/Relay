<?php

require_once __DIR__ . '/../../core/storage.php';
require_once __DIR__ . '/../../core/eventbus.php';

class NotesFeature {
    private $storage;
    private $eventBus;
    
    public function __construct() {
        $this->storage = new Storage();
        $this->eventBus = new EventBus();
    }
    
    public function updateNotes($roomId, $content, $username) {
        if (!$this->storage->roomExists($roomId)) {
            return array(
                'success' => false,
                'error' => 'Room not found'
            );
        }
        
        $this->storage->updateRoomState($roomId, array(
            'notes' => $content,
            'notesUpdatedBy' => $username,
            'notesUpdatedAt' => time()
        ));
        
        $this->eventBus->emit($roomId, 'notes_updated', array(
            'content' => $content,
            'updatedBy' => $username,
            'updatedAt' => time()
        ));
        
        return array(
            'success' => true,
            'content' => $content
        );
    }
   
    public function getNotes($roomId) {
        if (!$this->storage->roomExists($roomId)) {
            return array(
                'success' => false,
                'error' => 'Room not found'
            );
        }
        
        $state = $this->storage->getRoomState($roomId);
        $notes = isset($state['notes']) ? $state['notes'] : '';
        $updatedBy = isset($state['notesUpdatedBy']) ? $state['notesUpdatedBy'] : null;
        $updatedAt = isset($state['notesUpdatedAt']) ? $state['notesUpdatedAt'] : null;
        
        return array(
            'success' => true,
            'content' => $notes,
            'updatedBy' => $updatedBy,
            'updatedAt' => $updatedAt
        );
    }
    
    public function clearNotes($roomId, $username) {
        if (!$this->storage->roomExists($roomId)) {
            return array(
                'success' => false,
                'error' => 'Room not found'
            );
        }
        
        $this->storage->updateRoomState($roomId, array(
            'notes' => '',
            'notesUpdatedBy' => $username,
            'notesUpdatedAt' => time()
        ));
        
        $this->eventBus->emit($roomId, 'notes_cleared', array(
            'clearedBy' => $username
        ));
        
        return array(
            'success' => true
        );
    }
}