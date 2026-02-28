<?php

require_once __DIR__ . '/../../core/storage.php';
require_once __DIR__ . '/../../core/eventbus.php';

class FilesFeature {
    private $storage;
    private $eventBus;
    
    public function __construct() {
        $this->storage = new Storage();
        $this->eventBus = new EventBus();
    }
    
    public function uploadFile($roomId, $username) {
        if (!$this->storage->roomExists($roomId)) {
            return array(
                'success' => false,
                'error' => 'Room not found'
            );
        }
        
        if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            return array(
                'success' => false,
                'error' => 'No file uploaded or upload error'
            );
        }
        
        $file = $_FILES['file'];
        $fileName = basename($file['name']);
        $fileSize = $file['size'];
        $fileTmpPath = $file['tmp_name'];
        
        $maxSize = 50 * 1024 * 1024; 
        if ($fileSize > $maxSize) {
            return array(
                'success' => false,
                'error' => 'File too large (max 50MB)'
            );
        }
        
        $fileExt = pathinfo($fileName, PATHINFO_EXTENSION);
        $baseName = pathinfo($fileName, PATHINFO_FILENAME);
        $uniqueName = $baseName . '_' . time() . '.' . $fileExt;
        
        $filesDir = __DIR__ . '/../../data/rooms/' . $roomId . '/files/';
        $destination = $filesDir . $uniqueName;
        
        if (!move_uploaded_file($fileTmpPath, $destination)) {
            return array(
                'success' => false,
                'error' => 'Failed to save file'
            );
        }
        
        $fileInfo = array(
            'id' => uniqid(),
            'originalName' => $fileName,
            'storedName' => $uniqueName,
            'size' => $fileSize,
            'uploadedBy' => $username,
            'uploadedAt' => time()
        );
        
        $state = $this->storage->getRoomState($roomId);
        
        if (!isset($state['files'])) {
            $state['files'] = array();
        }
        $state['files'][] = $fileInfo;
        
        $this->storage->updateRoomState($roomId, array(
            'files' => $state['files']
        ));
        
        $this->eventBus->emit($roomId, 'file_uploaded', $fileInfo);
        
        return array(
            'success' => true,
            'file' => $fileInfo
        );
    }
    
    public function getFiles($roomId) {
        if (!$this->storage->roomExists($roomId)) {
            return array(
                'success' => false,
                'error' => 'Room not found'
            );
        }
        
        $state = $this->storage->getRoomState($roomId);
        $files = isset($state['files']) ? $state['files'] : array();
        
        return array(
            'success' => true,
            'files' => $files
        );
    }
    
    public function downloadFile($roomId, $fileId) {
        if (!$this->storage->roomExists($roomId)) {
            return array(
                'success' => false,
                'error' => 'Room not found'
            );
        }
        
        $state = $this->storage->getRoomState($roomId);
        $files = isset($state['files']) ? $state['files'] : array();
        
        $fileInfo = null;
        foreach ($files as $file) {
            if ($file['id'] === $fileId) {
                $fileInfo = $file;
                break;
            }
        }
        
        if (!$fileInfo) {
            return array(
                'success' => false,
                'error' => 'File not found'
            );
        }
        
        $filePath = __DIR__ . '/../../data/rooms/' . $roomId . '/files/' . $fileInfo['storedName'];
        
        if (!file_exists($filePath)) {
            return array(
                'success' => false,
                'error' => 'File does not exist'
            );
        }
        
        return array(
            'success' => true,
            'path' => $filePath,
            'name' => $fileInfo['originalName'],
            'size' => $fileInfo['size']
        );
    }
    
    public function deleteFile($roomId, $fileId, $username) {
        if (!$this->storage->roomExists($roomId)) {
            return array(
                'success' => false,
                'error' => 'Room not found'
            );
        }
        
        $state = $this->storage->getRoomState($roomId);
        $files = isset($state['files']) ? $state['files'] : array();
        
        $fileInfo = null;
        $newFiles = array();
        foreach ($files as $file) {
            if ($file['id'] === $fileId) {
                $fileInfo = $file;
            } else {
                $newFiles[] = $file;
            }
        }
        
        if (!$fileInfo) {
            return array(
                'success' => false,
                'error' => 'File not found'
            );
        }
        
        $filePath = __DIR__ . '/../../data/rooms/' . $roomId . '/files/' . $fileInfo['storedName'];
        if (file_exists($filePath)) {
            unlink($filePath);
        }
        
        $this->storage->updateRoomState($roomId, array(
            'files' => $newFiles
        ));
        
        $this->eventBus->emit($roomId, 'file_deleted', array(
            'fileId' => $fileId,
            'fileName' => $fileInfo['originalName'],
            'deletedBy' => $username
        ));
        
        return array(
            'success' => true,
            'message' => 'File deleted'
        );
    }
}