class PollsClient {
    constructor(app) {
        this.app = app;
        this.polls = [];
        this.init();
    }
    
    init() {
        this.loadPolls();
        
        this.setupEventListeners();
        
        this.app.on('poll_created', (data) => this.onPollCreated(data));
        this.app.on('vote_submitted', (data) => this.onVoteSubmitted(data));
        this.app.on('poll_closed', (data) => this.onPollClosed(data));
        this.app.on('poll_deleted', (data) => this.onPollDeleted(data));
        
        if (this.app.role !== 'teacher') {
            const createForm = document.getElementById('createPollForm');
            if (createForm) {
                createForm.style.display = 'none';
            }
        }
    }
    
    setupEventListeners() {
        const createBtn = document.getElementById('createPollBtn');
        if (createBtn && this.app.role === 'teacher') {
            createBtn.addEventListener('click', () => this.showCreateForm());
        }
        
        const submitPollBtn = document.getElementById('submitPollBtn');
        if (submitPollBtn) {
            submitPollBtn.addEventListener('click', () => this.createPoll());
        }
        
        const cancelPollBtn = document.getElementById('cancelPollBtn');
        if (cancelPollBtn) {
            cancelPollBtn.addEventListener('click', () => this.hideCreateForm());
        }
        
        const addOptionBtn = document.getElementById('addOptionBtn');
        if (addOptionBtn) {
            addOptionBtn.addEventListener('click', () => this.addOption());
        }
    }
    
    async loadPolls() {
        try {
            const response = await fetch(`api.php?action=get_polls&roomId=${this.app.roomId}`);
            const data = await response.json();
            
            if (data.success) {
                this.polls = data.polls;
                this.renderPolls();
            }
        } catch (error) {
            console.error('Error loading polls:', error);
        }
    }
    
    showCreateForm() {
        const form = document.getElementById('pollForm');
        const createBtn = document.getElementById('createPollBtn');
        if (form && createBtn) {
            form.style.display = 'block';
            createBtn.style.display = 'none';
            
            document.getElementById('pollQuestion').value = '';
            const optionsDiv = document.getElementById('pollOptions');
            optionsDiv.innerHTML = `
                <input type="text" class="poll-option-input" placeholder="Option 1">
                <input type="text" class="poll-option-input" placeholder="Option 2">
            `;
        }
    }
    
    hideCreateForm() {
        const form = document.getElementById('pollForm');
        const createBtn = document.getElementById('createPollBtn');
        if (form && createBtn) {
            form.style.display = 'none';
            createBtn.style.display = 'block';
        }
    }
    
    addOption() {
        const optionsDiv = document.getElementById('pollOptions');
        const currentOptions = optionsDiv.querySelectorAll('.poll-option-input');
        const newIndex = currentOptions.length + 1;
        
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'poll-option-input';
        input.placeholder = `Option ${newIndex}`;
        
        optionsDiv.appendChild(input);
    }
    
    async createPoll() {
        const question = document.getElementById('pollQuestion').value.trim();
        const optionInputs = document.querySelectorAll('.poll-option-input');
        
        const options = [];
        optionInputs.forEach(input => {
            const value = input.value.trim();
            if (value) options.push(value);
        });
        
        if (!question) {
            alert('Please enter a question');
            return;
        }
        
        if (options.length < 2) {
            alert('Please add at least 2 options');
            return;
        }
        
        try {
            const formData = new FormData();
            formData.append('action', 'create_poll');
            formData.append('roomId', this.app.roomId);
            formData.append('question', question);
            formData.append('options', JSON.stringify(options));
            formData.append('username', this.app.username);
            
            const response = await fetch('api.php', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.hideCreateForm();
            } else {
                alert('Error creating poll: ' + data.error);
            }
        } catch (error) {
            console.error('Error creating poll:', error);
            alert('Error creating poll');
        }
    }
    
    async submitVote(pollId, optionIndex) {
        try {
            const formData = new FormData();
            formData.append('action', 'submit_vote');
            formData.append('roomId', this.app.roomId);
            formData.append('pollId', pollId);
            formData.append('optionIndex', optionIndex);
            formData.append('username', this.app.username);
            
            const response = await fetch('api.php', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (!data.success) {
                alert('Error submitting vote: ' + data.error);
            }
        } catch (error) {
            console.error('Error submitting vote:', error);
        }
    }
    
    async closePoll(pollId) {
        try {
            const formData = new FormData();
            formData.append('action', 'close_poll');
            formData.append('roomId', this.app.roomId);
            formData.append('pollId', pollId);
            formData.append('username', this.app.username);
            
            const response = await fetch('api.php', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (!data.success) {
                alert('Error closing poll: ' + data.error);
            }
        } catch (error) {
            console.error('Error closing poll:', error);
        }
    }
    
    async deletePoll(pollId) {
        if (!confirm('Delete this poll?')) return;
        
        try {
            const formData = new FormData();
            formData.append('action', 'delete_poll');
            formData.append('roomId', this.app.roomId);
            formData.append('pollId', pollId);
            formData.append('username', this.app.username);
            
            const response = await fetch('api.php', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (!data.success) {
                alert('Error deleting poll: ' + data.error);
            }
        } catch (error) {
            console.error('Error deleting poll:', error);
        }
    }
    
    onPollCreated(poll) {
        const exists = this.polls.find(p => p.id === poll.id);
        if (exists) return;
        
        this.polls.push(poll);
        this.renderPolls();
        this.app.log(`Poll created: ${poll.question}`);
    }
    
    onVoteSubmitted(data) {
        const poll = this.polls.find(p => p.id === data.pollId);
        if (poll) {
            if (!poll.votes) poll.votes = {};
            poll.votes[data.username] = data.optionIndex;
            this.renderPolls();
        }
    }
    
    onPollClosed(data) {
        const poll = this.polls.find(p => p.id === data.pollId);
        if (poll) {
            poll.active = false;
            this.renderPolls();
            this.app.log(`Poll closed: ${poll.question}`);
        }
    }
    
    onPollDeleted(data) {
        this.polls = this.polls.filter(p => p.id !== data.pollId);
        this.renderPolls();
        this.app.log('Poll deleted');
    }
    
    renderPolls() {
        const pollsList = document.getElementById('pollsList');
        if (!pollsList) return;
        
        if (this.polls.length === 0) {
            pollsList.innerHTML = '<div class="no-polls">No polls yet</div>';
            return;
        }
        
        pollsList.innerHTML = '';
        
        this.polls.forEach(poll => {
            const pollDiv = document.createElement('div');
            pollDiv.className = 'poll-item' + (poll.active ? '' : ' poll-closed');
            
            const question = document.createElement('div');
            question.className = 'poll-question';
            question.textContent = poll.question;
            
            const status = document.createElement('div');
            status.className = 'poll-status';
            status.textContent = poll.active ? '🟢 Active' : '🔴 Closed';
            
            pollDiv.appendChild(question);
            pollDiv.appendChild(status);
            
            const totalVotes = Object.keys(poll.votes || {}).length;
            const voteCounts = {};
            poll.options.forEach((opt, idx) => voteCounts[idx] = 0);
            
            Object.values(poll.votes || {}).forEach(optIdx => {
                voteCounts[optIdx] = (voteCounts[optIdx] || 0) + 1;
            });
            
            const optionsDiv = document.createElement('div');
            optionsDiv.className = 'poll-options';
            
            poll.options.forEach((option, index) => {
                const optionDiv = document.createElement('div');
                optionDiv.className = 'poll-option';
                
                const userVoted = poll.votes && poll.votes[this.app.username] === index;
                const voteCount = voteCounts[index] || 0;
                const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
                
                const showResults = !poll.active || this.app.role === 'teacher' || poll.votes[this.app.username] !== undefined;
                
                if (poll.active && !showResults) {
                    const btn = document.createElement('button');
                    btn.className = 'vote-btn';
                    btn.textContent = option;
                    btn.onclick = () => this.submitVote(poll.id, index);
                    optionDiv.appendChild(btn);
                } else {
                    const resultDiv = document.createElement('div');
                    resultDiv.className = 'poll-result' + (userVoted ? ' user-voted' : '');
                    
                    const text = document.createElement('div');
                    text.className = 'poll-result-text';
                    text.textContent = option + (userVoted ? ' ✓' : '');
                    
                    const bar = document.createElement('div');
                    bar.className = 'poll-result-bar';
                    bar.style.width = percentage + '%';
                    
                    const stats = document.createElement('div');
                    stats.className = 'poll-result-stats';
                    stats.textContent = `${voteCount} vote${voteCount !== 1 ? 's' : ''} (${percentage}%)`;
                    
                    resultDiv.appendChild(text);
                    resultDiv.appendChild(bar);
                    resultDiv.appendChild(stats);
                    
                    optionDiv.appendChild(resultDiv);
                }
                
                optionsDiv.appendChild(optionDiv);
            });
            
            pollDiv.appendChild(optionsDiv);
            
            if (this.app.role === 'teacher') {
                const controls = document.createElement('div');
                controls.className = 'poll-controls';
                
                if (poll.active) {
                    const closeBtn = document.createElement('button');
                    closeBtn.className = 'btn-close-poll';
                    closeBtn.textContent = 'Close Poll';
                    closeBtn.onclick = () => this.closePoll(poll.id);
                    controls.appendChild(closeBtn);
                }
                
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'btn-delete-poll';
                deleteBtn.textContent = 'Delete';
                deleteBtn.onclick = () => this.deletePoll(poll.id);
                controls.appendChild(deleteBtn);
                
                const totalDiv = document.createElement('span');
                totalDiv.className = 'poll-total';
                totalDiv.textContent = `Total votes: ${totalVotes}`;
                controls.appendChild(totalDiv);
                
                pollDiv.appendChild(controls);
            }
            
            pollsList.appendChild(pollDiv);
        });
    }
}