<?php
error_reporting(E_ALL);
ini_set('display_errors', 0); // Don't display errors in output
ini_set('log_errors', 1);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

function handleError($errno, $errstr, $errfile, $errline) {
    header('Content-Type: application/json');
    echo json_encode(array(
        'success' => false,
        'error' => 'Server error: ' . $errstr,
        'file' => basename($errfile),
        'line' => $errline
    ));
    exit;
}

set_error_handler('handleError');

try {
    require_once __DIR__ . '/core/room.php';
    require_once __DIR__ . '/core/eventbus.php';
    require_once __DIR__ . '/features/files/server.php';
    require_once __DIR__ . '/features/notes/server.php';
    require_once __DIR__ . '/features/polls/server.php';

    $roomManager = new RoomManager();
    $eventBus = new EventBus();
    $filesFeature = new FilesFeature();
    $notesFeature = new NotesFeature();
    $pollsFeature = new PollsFeature();

    $action = isset($_GET['action']) ? $_GET['action'] : (isset($_POST['action']) ? $_POST['action'] : null);

    $response = array();
    
    if ($action !== 'download_file') {
        header('Content-Type: application/json');
    }

    switch ($action) {
        case 'create_room':
            $role = isset($_POST['role']) ? $_POST['role'] : 'teacher';
            $response = $roomManager->createRoom($role);
            break;
            
        case 'join_room':
            $roomId = isset($_POST['roomId']) ? $_POST['roomId'] : null;
            $username = isset($_POST['username']) ? $_POST['username'] : 'Anonymous';
            $role = isset($_POST['role']) ? $_POST['role'] : 'student';
            
            if (!$roomId) {
                $response = array(
                    'success' => false,
                    'error' => 'Room ID is required'
                );
            } else {
                $response = $roomManager->joinRoom($roomId, $username, $role);
            }
            break;
            
        case 'get_room':
            $roomId = isset($_GET['roomId']) ? $_GET['roomId'] : null;
            
            if (!$roomId) {
                $response = array(
                    'success' => false,
                    'error' => 'Room ID is required'
                );
            } else {
                $response = $roomManager->getRoomInfo($roomId);
            }
            break;
            
        case 'poll':
            $roomId = isset($_GET['roomId']) ? $_GET['roomId'] : null;
            $afterId = isset($_GET['after']) ? intval($_GET['after']) : 0;
            
            if (!$roomId) {
                $response = array(
                    'success' => false,
                    'error' => 'Room ID is required'
                );
            } else {
                $response = $eventBus->poll($roomId, $afterId);
            }
            break;
            
        case 'emit':
            $roomId = isset($_POST['roomId']) ? $_POST['roomId'] : null;
            $eventType = isset($_POST['type']) ? $_POST['type'] : null;
            $eventDataJson = isset($_POST['data']) ? $_POST['data'] : '{}';
            $eventData = json_decode($eventDataJson, true);
            
            if (!$roomId || !$eventType) {
                $response = array(
                    'success' => false,
                    'error' => 'Room ID and event type are required'
                );
            } else {
                $response = $eventBus->emit($roomId, $eventType, $eventData);
            }
            break;
            
        case 'get_events':
            $roomId = isset($_GET['roomId']) ? $_GET['roomId'] : null;
            
            if (!$roomId) {
                $response = array(
                    'success' => false,
                    'error' => 'Room ID is required'
                );
            } else {
                $response = $eventBus->getAllEvents($roomId);
            }
            break;
            
        case 'upload_file':
            $roomId = isset($_POST['roomId']) ? $_POST['roomId'] : null;
            $username = isset($_POST['username']) ? $_POST['username'] : 'Anonymous';
            
            if (!$roomId) {
                $response = array(
                    'success' => false,
                    'error' => 'Room ID is required'
                );
            } else {
                $response = $filesFeature->uploadFile($roomId, $username);
            }
            break;
            
        case 'get_files':
            $roomId = isset($_GET['roomId']) ? $_GET['roomId'] : null;
            
            if (!$roomId) {
                $response = array(
                    'success' => false,
                    'error' => 'Room ID is required'
                );
            } else {
                $response = $filesFeature->getFiles($roomId);
            }
            break;
            
        case 'download_file':
            $roomId = isset($_GET['roomId']) ? $_GET['roomId'] : null;
            $fileId = isset($_GET['fileId']) ? $_GET['fileId'] : null;
            
            if (!$roomId || !$fileId) {
                header('Content-Type: application/json');
                $response = array(
                    'success' => false,
                    'error' => 'Room ID and File ID are required'
                );
            } else {
                $result = $filesFeature->downloadFile($roomId, $fileId);
                
                if ($result['success']) {
                    while (ob_get_level()) {
                        ob_end_clean();
                    }
                    
                    if (!file_exists($result['path'])) {
                        header('Content-Type: application/json');
                        echo json_encode(array(
                            'success' => false,
                            'error' => 'File not found on disk'
                        ));
                        exit;
                    }
                    
                    header('Content-Type: ' . $result['type']);
                    header('Content-Disposition: attachment; filename="' . $result['name'] . '"');
                    header('Content-Length: ' . filesize($result['path']));
                    header('Cache-Control: must-revalidate');
                    header('Pragma: public');
                    header('Content-Transfer-Encoding: binary');
                    
                    $file = fopen($result['path'], 'rb');
                    if ($file) {
                        while (!feof($file)) {
                            echo fread($file, 8192); // Read 8KB at a time
                            flush(); // Send to browser immediately
                        }
                        fclose($file);
                    } else {
                        header('Content-Type: application/json');
                        echo json_encode(array(
                            'success' => false,
                            'error' => 'Could not open file'
                        ));
                    }
                    exit;
                } else {
                    header('Content-Type: application/json');
                    $response = $result;
                }
            }
            break;
            
        case 'delete_file':
            $roomId = isset($_POST['roomId']) ? $_POST['roomId'] : null;
            $fileId = isset($_POST['fileId']) ? $_POST['fileId'] : null;
            $username = isset($_POST['username']) ? $_POST['username'] : 'Anonymous';
            
            if (!$roomId || !$fileId) {
                $response = array(
                    'success' => false,
                    'error' => 'Room ID and File ID are required'
                );
            } else {
                $response = $filesFeature->deleteFile($roomId, $fileId, $username);
            }
            break;
            
        case 'update_notes':
            $roomId = isset($_POST['roomId']) ? $_POST['roomId'] : null;
            $content = isset($_POST['content']) ? $_POST['content'] : '';
            $username = isset($_POST['username']) ? $_POST['username'] : 'Anonymous';
            
            if (!$roomId) {
                $response = array(
                    'success' => false,
                    'error' => 'Room ID is required'
                );
            } else {
                $response = $notesFeature->updateNotes($roomId, $content, $username);
            }
            break;
            
        case 'get_notes':
            $roomId = isset($_GET['roomId']) ? $_GET['roomId'] : null;
            
            if (!$roomId) {
                $response = array(
                    'success' => false,
                    'error' => 'Room ID is required'
                );
            } else {
                $response = $notesFeature->getNotes($roomId);
            }
            break;
            
        case 'clear_notes':
            $roomId = isset($_POST['roomId']) ? $_POST['roomId'] : null;
            $username = isset($_POST['username']) ? $_POST['username'] : 'Anonymous';
            
            if (!$roomId) {
                $response = array(
                    'success' => false,
                    'error' => 'Room ID is required'
                );
            } else {
                $response = $notesFeature->clearNotes($roomId, $username);
            }
            break;
            
        case 'create_poll':
            // Create a new poll
            $roomId = isset($_POST['roomId']) ? $_POST['roomId'] : null;
            $question = isset($_POST['question']) ? $_POST['question'] : '';
            $optionsJson = isset($_POST['options']) ? $_POST['options'] : '[]';
            $options = json_decode($optionsJson, true);
            $username = isset($_POST['username']) ? $_POST['username'] : 'Anonymous';
            
            if (!$roomId) {
                $response = array(
                    'success' => false,
                    'error' => 'Room ID is required'
                );
            } else {
                $response = $pollsFeature->createPoll($roomId, $question, $options, $username);
            }
            break;
            
        case 'submit_vote':
            $roomId = isset($_POST['roomId']) ? $_POST['roomId'] : null;
            $pollId = isset($_POST['pollId']) ? $_POST['pollId'] : null;
            $optionIndex = isset($_POST['optionIndex']) ? intval($_POST['optionIndex']) : -1;
            $username = isset($_POST['username']) ? $_POST['username'] : 'Anonymous';
            
            if (!$roomId || !$pollId) {
                $response = array(
                    'success' => false,
                    'error' => 'Room ID and Poll ID are required'
                );
            } else {
                $response = $pollsFeature->submitVote($roomId, $pollId, $optionIndex, $username);
            }
            break;
            
        case 'close_poll':
            $roomId = isset($_POST['roomId']) ? $_POST['roomId'] : null;
            $pollId = isset($_POST['pollId']) ? $_POST['pollId'] : null;
            $username = isset($_POST['username']) ? $_POST['username'] : 'Anonymous';
            
            if (!$roomId || !$pollId) {
                $response = array(
                    'success' => false,
                    'error' => 'Room ID and Poll ID are required'
                );
            } else {
                $response = $pollsFeature->closePoll($roomId, $pollId, $username);
            }
            break;
            
        case 'get_polls':
            $roomId = isset($_GET['roomId']) ? $_GET['roomId'] : null;
            
            if (!$roomId) {
                $response = array(
                    'success' => false,
                    'error' => 'Room ID is required'
                );
            } else {
                $response = $pollsFeature->getPolls($roomId);
            }
            break;
            
        case 'delete_poll':
            $roomId = isset($_POST['roomId']) ? $_POST['roomId'] : null;
            $pollId = isset($_POST['pollId']) ? $_POST['pollId'] : null;
            $username = isset($_POST['username']) ? $_POST['username'] : 'Anonymous';
            
            if (!$roomId || !$pollId) {
                $response = array(
                    'success' => false,
                    'error' => 'Room ID and Poll ID are required'
                );
            } else {
                $response = $pollsFeature->deletePoll($roomId, $pollId, $username);
            }
            break;
            
        default:
            $response = array(
                'success' => false,
                'error' => 'Invalid action',
                'provided_action' => $action,
                'available_actions' => array(
                    'create_room', 'join_room', 'get_room', 'poll', 'emit', 'get_events',
                    'upload_file', 'get_files', 'download_file', 'delete_file',
                    'update_notes', 'get_notes', 'clear_notes',
                    'create_poll', 'submit_vote', 'close_poll', 'get_polls', 'delete_poll'
                )
            );
    }

    echo json_encode($response, JSON_PRETTY_PRINT);

} catch (Exception $e) {
    echo json_encode(array(
        'success' => false,
        'error' => 'Exception: ' . $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ));
}