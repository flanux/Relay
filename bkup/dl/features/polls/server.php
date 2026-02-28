<?php

require_once __DIR__ . '/../../core/storage.php';
require_once __DIR__ . '/../../core/eventbus.php';

class PollsFeature {
    private $storage;
    private $eventBus;
    
    public function __construct() {
        $this->storage = new Storage();
        $this->eventBus = new EventBus();
    }
    
    public function createPoll($roomId, $question, $options, $username) {
        if (!$this->storage->roomExists($roomId)) {
            return array(
                'success' => false,
                'error' => 'Room not found'
            );
        }
        
        if (empty($question) || empty($options) || count($options) < 2) {
            return array(
                'success' => false,
                'error' => 'Poll needs a question and at least 2 options'
            );
        }
        
        $state = $this->storage->getRoomState($roomId);
        
        if (!isset($state['polls'])) {
            $state['polls'] = array();
        }
        
        $poll = array(
            'id' => uniqid(),
            'question' => $question,
            'options' => $options,
            'votes' => array(), // array of {username: optionIndex}
            'createdBy' => $username,
            'createdAt' => time(),
            'active' => true
        );
        
        $state['polls'][] = $poll;
        
        $this->storage->updateRoomState($roomId, array(
            'polls' => $state['polls']
        ));
        
        $this->eventBus->emit($roomId, 'poll_created', $poll);
        
        return array(
            'success' => true,
            'poll' => $poll
        );
    }
    
    public function submitVote($roomId, $pollId, $optionIndex, $username) {
        if (!$this->storage->roomExists($roomId)) {
            return array(
                'success' => false,
                'error' => 'Room not found'
            );
        }
        
        $state = $this->storage->getRoomState($roomId);
        $polls = isset($state['polls']) ? $state['polls'] : array();
        
        $pollIndex = -1;
        $poll = null;
        for ($i = 0; $i < count($polls); $i++) {
            if ($polls[$i]['id'] === $pollId) {
                $pollIndex = $i;
                $poll = $polls[$i];
                break;
            }
        }
        
        if (!$poll) {
            return array(
                'success' => false,
                'error' => 'Poll not found'
            );
        }
        
        if (!$poll['active']) {
            return array(
                'success' => false,
                'error' => 'Poll is closed'
            );
        }
        
        if ($optionIndex < 0 || $optionIndex >= count($poll['options'])) {
            return array(
                'success' => false,
                'error' => 'Invalid option'
            );
        }
        
        $poll['votes'][$username] = $optionIndex;
        
        $polls[$pollIndex] = $poll;
        
        $this->storage->updateRoomState($roomId, array(
            'polls' => $polls
        ));
        
        $this->eventBus->emit($roomId, 'vote_submitted', array(
            'pollId' => $pollId,
            'username' => $username,
            'optionIndex' => $optionIndex
        ));
        
        return array(
            'success' => true,
            'poll' => $poll
        );
    }
    
    public function closePoll($roomId, $pollId, $username) {
        if (!$this->storage->roomExists($roomId)) {
            return array(
                'success' => false,
                'error' => 'Room not found'
            );
        }
        
        $state = $this->storage->getRoomState($roomId);
        $polls = isset($state['polls']) ? $state['polls'] : array();
        
        $pollIndex = -1;
        $poll = null;
        for ($i = 0; $i < count($polls); $i++) {
            if ($polls[$i]['id'] === $pollId) {
                $pollIndex = $i;
                $polls[$i]['active'] = false;
                $poll = $polls[$i];
                break;
            }
        }
        
        if (!$poll) {
            return array(
                'success' => false,
                'error' => 'Poll not found'
            );
        }
        
        $this->storage->updateRoomState($roomId, array(
            'polls' => $polls
        ));
        
        $this->eventBus->emit($roomId, 'poll_closed', array(
            'pollId' => $pollId,
            'closedBy' => $username
        ));
        
        return array(
            'success' => true,
            'poll' => $poll
        );
    }
    
    public function getPolls($roomId) {
        if (!$this->storage->roomExists($roomId)) {
            return array(
                'success' => false,
                'error' => 'Room not found'
            );
        }
        
        $state = $this->storage->getRoomState($roomId);
        $polls = isset($state['polls']) ? $state['polls'] : array();
        
        return array(
            'success' => true,
            'polls' => $polls
        );
    }
    
    public function deletePoll($roomId, $pollId, $username) {
        if (!$this->storage->roomExists($roomId)) {
            return array(
                'success' => false,
                'error' => 'Room not found'
            );
        }
        
        $state = $this->storage->getRoomState($roomId);
        $polls = isset($state['polls']) ? $state['polls'] : array();
        
        $newPolls = array();
        foreach ($polls as $poll) {
            if ($poll['id'] !== $pollId) {
                $newPolls[] = $poll;
            }
        }
        
        $this->storage->updateRoomState($roomId, array(
            'polls' => $newPolls
        ));
        
        $this->eventBus->emit($roomId, 'poll_deleted', array(
            'pollId' => $pollId,
            'deletedBy' => $username
        ));
        
        return array(
            'success' => true
        );
    }
}