/**
 * PollManager - Real-time polling and voting
 */
class PollManager {
    constructor(p2pManager) {
        this.p2p = p2pManager;
        this.activePoll = null;
        this.votes = new Map(); // pollId -> {optionIndex: count}
        this.userVotes = new Set(); // Track who voted (prevent double voting)

        // Listen for poll messages
        this.p2p.onMessage((peerId, data) => {
            this.handleMessage(data, peerId);
        });
    }

    handleMessage(data, peerId) {
        switch (data.type) {
            case 'poll-created':
                if (!this.p2p.isTeacher) {
                    this.showPoll(data.poll);
                }
                break;
            case 'poll-vote':
                if (this.p2p.isTeacher) {
                    this.recordVote(data.pollId, data.optionIndex, data.voter);
                }
                break;
            case 'poll-closed':
                this.closePollUI();
                break;
            case 'poll-results':
                if (!this.p2p.isTeacher) {
                    this.updateResults(data.results);
                }
                break;
        }
    }

    // Teacher: Create new poll
    createPoll(question, options) {
        const poll = {
            id: Date.now().toString(36),
            question: question,
            options: options.map((opt, idx) => ({ text: opt, index: idx, votes: 0 })),
            created: Date.now(),
            totalVotes: 0
        };

        this.activePoll = poll;
        this.votes.set(poll.id, new Array(options.length).fill(0));

        // Broadcast to all students
        this.p2p.broadcast({
            type: 'poll-created',
            poll: poll
        });

        // Show in teacher UI
        this.showTeacherPoll(poll);

        return poll;
    }

    // Student: Submit vote
    submitVote(pollId, optionIndex, voter) {
        // Prevent double voting
        const voteKey = `${pollId}-${voter}`;
        if (this.userVotes.has(voteKey)) {
            return false;
        }

        this.userVotes.add(voteKey);

        this.p2p.broadcast({
            type: 'poll-vote',
            pollId: pollId,
            optionIndex: optionIndex,
            voter: voter
        });

        // Update UI to show voted
        this.showVotedState(optionIndex);

        return true;
    }

    // Teacher: Record incoming vote
    recordVote(pollId, optionIndex, voter) {
        if (!this.activePoll || this.activePoll.id !== pollId) return;

        const voteKey = `${pollId}-${voter}`;
        if (this.userVotes.has(voteKey)) return; // Already voted

        this.userVotes.add(voteKey);
        this.activePoll.options[optionIndex].votes++;
        this.activePoll.totalVotes++;

        // Update UI
        this.updateTeacherResults();

        // Broadcast updated results to all
        this.p2p.broadcast({
            type: 'poll-results',
            results: this.activePoll.options
        });
    }

    // Teacher: Close poll
    closePoll() {
        if (!this.activePoll) return;

        this.p2p.broadcast({
            type: 'poll-closed',
            pollId: this.activePoll.id
        });

        this.activePoll = null;
        this.userVotes.clear();

        // Reset UI
        document.getElementById('pollCreator').classList.remove('hidden');
        document.getElementById('activePoll').classList.add('hidden');
    }

    // UI: Show poll for student
    showPoll(poll) {
        const container = document.getElementById('studentPolls');
        if (!container) return;

        container.innerHTML = `
            <div class="poll-card">
                <h4>${poll.question}</h4>
                <div class="poll-options">
                    ${poll.options.map(opt => `
                        <button class="poll-option-btn" onclick="app.vote('${poll.id}', ${opt.index})">
                            ${opt.text}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // UI: Show poll for teacher
    showTeacherPoll(poll) {
        document.getElementById('pollCreator').classList.add('hidden');
        const activePoll = document.getElementById('activePoll');
        activePoll.classList.remove('hidden');

        document.getElementById('activePollQuestion').textContent = poll.question;
        this.updateTeacherResults();
    }

    // UI: Update teacher results
    updateTeacherResults() {
        if (!this.activePoll) return;

        const container = document.getElementById('pollResults');
        const total = this.activePoll.totalVotes || 1;

        container.innerHTML = this.activePoll.options.map(opt => {
            const percent = ((opt.votes / total) * 100).toFixed(1);
            return `
                <div class="poll-bar">
                    <div class="poll-bar-fill" style="width: ${percent}%">
                        ${opt.text} (${opt.votes} votes - ${percent}%)
                    </div>
                </div>
            `;
        }).join('');
    }

    // UI: Update student results
    updateResults(results) {
        const container = document.getElementById('studentPolls');
        const total = results.reduce((sum, opt) => sum + opt.votes, 0) || 1;

        container.innerHTML = `
            <div class="poll-results">
                <h4>Results</h4>
                ${results.map(opt => {
                    const percent = ((opt.votes / total) * 100).toFixed(1);
                    return `
                        <div class="result-item">
                            <span>${opt.text}</span>
                            <div class="result-bar">
                                <div class="result-fill" style="width: ${percent}%"></div>
                                <span>${percent}%</span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    // UI: Show voted state
    showVotedState(selectedIndex) {
        const buttons = document.querySelectorAll('.poll-option-btn');
        buttons.forEach((btn, idx) => {
            if (idx === selectedIndex) {
                btn.classList.add('voted');
            }
            btn.disabled = true;
        });
    }

    // UI: Close poll UI
    closePollUI() {
        const container = document.getElementById('studentPolls');
        if (container) {
            container.innerHTML = '<p class="empty">Poll ended</p>';
        }
    }
}

// Export
window.PollManager = PollManager;