/**
 * PollManager - Quick polling system
 */
class PollManager {
    constructor(p2p) {
        this.p2p = p2p;
        this.currentPoll = null;
        this.pollResponses = new Map();
    }

    createPoll(question, options) {
        if (!question || !options || options.length < 2) {
            throw new Error('Poll needs a question and at least 2 options');
        }

        this.currentPoll = {
            id: Date.now().toString(),
            question: question,
            options: options,
            responses: new Map()
        };

        this.pollResponses.clear();

        // Broadcast poll to all participants
        this.p2p.broadcast({
            type: 'poll_created',
            poll: {
                id: this.currentPoll.id,
                question: this.currentPoll.question,
                options: this.currentPoll.options
            }
        });

        this.displayHostPoll();
        return this.currentPoll.id;
    }

    displayHostPoll() {
        const creator = document.getElementById('pollCreator');
        const activePoll = document.getElementById('activePoll');
        const question = document.getElementById('activePollQuestion');
        const results = document.getElementById('pollResults');

        if (!creator || !activePoll || !question || !results) return;

        creator.classList.add('hidden');
        activePoll.classList.remove('hidden');
        
        question.textContent = this.currentPoll.question;
        this.updatePollResults();
    }

    displayParticipantPoll(poll) {
        const container = document.getElementById('participantPolls');
        if (!container) return;

        // Remove empty state
        const empty = container.querySelector('.empty');
        if (empty) empty.remove();

        // Create poll UI
        const pollDiv = document.createElement('div');
        pollDiv.className = 'poll-item';
        pollDiv.dataset.pollId = poll.id;
        
        const questionH4 = document.createElement('h4');
        questionH4.textContent = poll.question;
        
        const optionsDiv = document.createElement('div');
        optionsDiv.className = 'poll-options';

        poll.options.forEach((option, index) => {
            const btn = document.createElement('button');
            btn.className = 'poll-option-btn';
            btn.textContent = option;
            btn.dataset.optionIndex = index;
            
            btn.onclick = () => {
                this.submitVote(poll.id, index);
                
                // Mark as selected
                optionsDiv.querySelectorAll('.poll-option-btn').forEach(b => {
                    b.classList.remove('selected');
                });
                btn.classList.add('selected');
            };
            
            optionsDiv.appendChild(btn);
        });

        pollDiv.appendChild(questionH4);
        pollDiv.appendChild(optionsDiv);
        container.appendChild(pollDiv);

        // Switch to polls tab
        const pollsTab = document.querySelector('[data-tab="polls"]');
        if (pollsTab && !pollsTab.classList.contains('active')) {
            pollsTab.click();
        }
    }

    submitVote(pollId, optionIndex) {
        this.p2p.broadcast({
            type: 'poll_vote',
            pollId: pollId,
            option: optionIndex,
            voterId: this.p2p.localId
        });
    }

    receiveVote(voterId, optionIndex) {
        if (!this.currentPoll) return;

        this.pollResponses.set(voterId, optionIndex);
        this.currentPoll.responses.set(voterId, optionIndex);
        this.updatePollResults();
    }

    updatePollResults() {
        const resultsDiv = document.getElementById('pollResults');
        if (!resultsDiv || !this.currentPoll) return;

        resultsDiv.innerHTML = '';

        // Count votes for each option
        const votes = new Array(this.currentPoll.options.length).fill(0);
        const totalVotes = this.pollResponses.size;

        this.pollResponses.forEach(optionIndex => {
            votes[optionIndex]++;
        });

        // Display bars
        this.currentPoll.options.forEach((option, index) => {
            const count = votes[index];
            const percentage = totalVotes > 0 ? (count / totalVotes * 100) : 0;

            const barDiv = document.createElement('div');
            barDiv.className = 'poll-bar';
            
            const label = document.createElement('div');
            label.className = 'poll-bar-label';
            label.innerHTML = `
                <span>${option}</span>
                <span>${count} vote${count !== 1 ? 's' : ''}</span>
            `;

            const container = document.createElement('div');
            container.className = 'poll-bar-fill-container';
            
            const fill = document.createElement('div');
            fill.className = 'poll-bar-fill';
            fill.style.width = percentage + '%';
            fill.textContent = percentage > 10 ? Math.round(percentage) + '%' : '';

            container.appendChild(fill);
            barDiv.appendChild(label);
            barDiv.appendChild(container);
            resultsDiv.appendChild(barDiv);
        });
    }

    closePoll() {
        if (!this.currentPoll) return;

        // Notify participants
        this.p2p.broadcast({
            type: 'poll_closed',
            pollId: this.currentPoll.id
        });

        // Reset UI
        const creator = document.getElementById('pollCreator');
        const activePoll = document.getElementById('activePoll');

        if (creator && activePoll) {
            creator.classList.remove('hidden');
            activePoll.classList.add('hidden');
        }

        // Clear poll question input
        const questionInput = document.getElementById('pollQuestion');
        if (questionInput) {
            questionInput.value = '';
        }

        // Clear responses
        this.currentPoll = null;
        this.pollResponses.clear();
    }

    handlePollClosed(pollId) {
        const pollDiv = document.querySelector(`[data-poll-id="${pollId}"]`);
        if (pollDiv) {
            pollDiv.remove();
        }

        // Show empty state if no polls
        const container = document.getElementById('participantPolls');
        if (container && container.children.length === 0) {
            container.innerHTML = '<p class="empty">No active polls</p>';
        }
    }

    addOption() {
        const optionsContainer = document.getElementById('pollOptions');
        if (!optionsContainer) return;

        const currentCount = optionsContainer.querySelectorAll('.poll-option').length;
        if (currentCount >= 6) {
            alert('Maximum 6 options allowed');
            return;
        }

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'poll-option';
        input.placeholder = `Option ${currentCount + 1}`;
        input.maxLength = 50;
        
        optionsContainer.appendChild(input);
    }
}

// Export
window.PollManager = PollManager;
