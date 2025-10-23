document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const dashboardContainer = document.getElementById('dashboard-container');
    const pageContainers = document.querySelectorAll('.page-container');
    const loader = document.getElementById('loader');
    const loaderText = document.getElementById('loader-text');

    // Quiz Setup Elements
    const quizSetupContainer = document.getElementById('quiz-setup-container');
    const syllabusInput = document.getElementById('syllabus-input');
    const syllabusPdfUpload = document.getElementById('syllabus-pdf-upload');
    const pdfStatus = document.getElementById('pdf-status');
    const topicSelect = document.getElementById('topic-select');
    const startQuizBtn = document.getElementById('start-quiz-btn');
    const quizDurationInput = document.getElementById('quiz-duration'); // NEW

    // Quiz & Results Elements
    const quizContainer = document.getElementById('quiz-container');
    const quizTimerDisplayContainer = document.getElementById('quiz-timer-display'); // NEW
    const quizTimerDisplay = document.getElementById('quiz-timer'); // NEW
    const resultsContainer = document.getElementById('results-container');
    const reportSummary = document.getElementById('report-summary');
    const pastReportsList = document.getElementById('past-reports-list');

    // Notes Helper Elements
    const notesPdfUpload = document.getElementById('notes-pdf-upload');
    const notesPdfStatus = document.getElementById('notes-pdf-status');
    const summarizeBtn = document.getElementById('summarize-btn');
    const expandBtn = document.getElementById('expand-btn');
    const notesOutputContainer = document.getElementById('notes-output-container');
    const processedNotesText = document.getElementById('processed-notes-text');
    const downloadNotesPdfBtn = document.getElementById('download-notes-pdf-btn');
    const pastNotesList = document.getElementById('past-notes-list');

    // Exam Prep Elements
    const examDateInput = document.getElementById('exam-date');
    const examSyllabusUpload = document.getElementById('exam-syllabus-upload');
    const examSyllabusStatus = document.getElementById('exam-syllabus-status');
    const generatePlanBtn = document.getElementById('generate-plan-btn');
    const planOutputContainer = document.getElementById('plan-output-container');
    const downloadPlanPdfBtn = document.getElementById('download-plan-pdf-btn');

    // Material Suggestion Elements
    const materialSyllabusInput = document.getElementById('material-syllabus-input');
    const materialSyllabusPdfUpload = document.getElementById('material-syllabus-pdf-upload');
    const materialPdfStatus = document.getElementById('material-pdf-status');
    const getSuggestionsBtn = document.getElementById('get-suggestions-btn');
    const suggestionsOutputContainer = document.getElementById('suggestions-output-container');
    const suggestionsList = document.getElementById('suggestions-list');

    // Chatbot Elements
    const chatbotToggleBtn = document.getElementById('chatbot-toggle-btn');
    const chatbotContainer = document.getElementById('chatbot-container');
    const chatbotCloseBtn = document.getElementById('chatbot-close-btn');
    const chatbotMessages = document.getElementById('chatbot-messages');
    const chatbotInput = document.getElementById('chatbot-input');
    const chatbotSendBtn = document.getElementById('chatbot-send-btn');

    // Concentration Mode Elements // NEW
    const concentrationContainer = document.getElementById('concentration-container');
    const startConcentrationBtn = document.getElementById('start-concentration-btn');
    const concentrationDurationInput = document.getElementById('concentration-duration');
    const concentrationOverlay = document.getElementById('concentration-overlay');
    const concentrationTimer = document.getElementById('concentration-timer');


    // --- App State ---
    let quizData = [];
    let currentTopic = '';
    let fullSyllabusTopics = [];
    let generatedPlanText = '';
    let chatHistory = [];
    let quizTimerInterval = null; // NEW
    let concentrationTimerInterval = null; // NEW
    let isQuizSubmitted = false; // NEW
    const API_BASE_URL = 'http://127.0.0.1:5000';

    // --- Navigation ---
    document.querySelectorAll('.dashboard-btn').forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.getAttribute('data-target');
            showPage(targetId);
        });
    });

    document.querySelectorAll('.back-btn, #back-to-dashboard-btn').forEach(button => {
        button.addEventListener('click', () => showPage('dashboard-container'));
    });

    function showPage(pageId) {
        pageContainers.forEach(container => container.classList.add('hidden'));
        resultsContainer.classList.add('hidden');
        dashboardContainer.classList.add('hidden');

        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.classList.remove('hidden');
            if (pageId === 'reports-container') loadPastReports();
            if (pageId === 'quiz-setup-container') resetQuizSetup();
            if (pageId === 'notes-container') loadPastNotes();
            if (pageId === 'material-suggestion-container') resetMaterialSuggestion();
        }
    }

    // --- Event Listeners ---
    syllabusInput.addEventListener('input', updateTopicDropdownFromText);
    syllabusPdfUpload.addEventListener('change', handlePdfUpload);
    startQuizBtn.addEventListener('click', fetchQuiz);

    notesPdfUpload.addEventListener('change', handleNotesUpload);
    summarizeBtn.addEventListener('click', () => processNotes('summarize'));
    expandBtn.addEventListener('click', () => processNotes('expand'));
    downloadNotesPdfBtn.addEventListener('click', downloadNotesAsPdf);

    examSyllabusUpload.addEventListener('change', handleExamSyllabusUpload);
    generatePlanBtn.addEventListener('click', generateStudyPlan);
    downloadPlanPdfBtn.addEventListener('click', downloadPlanAsPdf);

    materialSyllabusPdfUpload.addEventListener('change', handleMaterialPdfUpload);
    getSuggestionsBtn.addEventListener('click', fetchMaterialSuggestions);

    chatbotToggleBtn.addEventListener('click', toggleChatbot);
    chatbotCloseBtn.addEventListener('click', toggleChatbot);
    chatbotSendBtn.addEventListener('click', sendMessage);
    chatbotInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendMessage();
        }
    });

    // NEW Concentration Mode Listeners
    startConcentrationBtn.addEventListener('click', startConcentrationMode);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    // --- Quiz Functions ---
    function updateTopicDropdownFromText() {
        if (syllabusPdfUpload.value) return;
        const topics = syllabusInput.value.split('\n').filter(topic => topic.trim() !== '');
        populateTopicDropdown(topics, "Select a Topic");
        fullSyllabusTopics = [];
    }
    async function handlePdfUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        pdfStatus.textContent = `Uploading "${file.name}"...`;
        syllabusInput.value = '';
        syllabusInput.disabled = true;
        showLoader(true, 'Analyzing your syllabus...');
        const formData = new FormData();
        formData.append('syllabus', file);
        try {
            const response = await fetch(`${API_BASE_URL}/parse-syllabus`, { method: 'POST', body: formData });
            if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || 'Failed to parse PDF.'); }
            const data = await response.json();
            pdfStatus.textContent = `Successfully parsed "${file.name}"!`;
            populateTopicDropdown(data.topics, "Quiz on Full Syllabus");
            fullSyllabusTopics = data.topics;
        } catch (error) {
            console.error('Error parsing PDF:', error);
            pdfStatus.textContent = `Error: ${error.message}. Please try again.`;
            resetQuizSetup();
        } finally { showLoader(false); }
    }
    function populateTopicDropdown(topics, fullSyllabusOptionText) {
        topicSelect.innerHTML = '';
        if (topics.length > 0) {
            if(fullSyllabusTopics.length > 0){
                 const allTopicsOption = document.createElement('option');
                allTopicsOption.value = 'full-syllabus';
                allTopicsOption.textContent = `--- ${fullSyllabusOptionText} ---`;
                topicSelect.appendChild(allTopicsOption);
            }
            topics.forEach(topic => {
                const option = document.createElement('option');
                option.value = topic.trim();
                option.textContent = topic.trim();
                topicSelect.appendChild(option);
            });
            topicSelect.disabled = false;
            startQuizBtn.disabled = false;
        } else {
            const defaultOption = document.createElement('option');
            defaultOption.textContent = 'Provide syllabus first';
            topicSelect.appendChild(defaultOption);
            topicSelect.disabled = true;
            startQuizBtn.disabled = true;
        }
    }
    async function fetchQuiz() {
        const selectedTopicValue = topicSelect.value;
        const numQuestions = document.getElementById('num-questions').value;
        const difficulty = document.getElementById('difficulty-select').value;
        const duration = parseInt(quizDurationInput.value, 10); // NEW

        let requestBody = {};
        if (selectedTopicValue === 'full-syllabus') {
            currentTopic = "Full Syllabus Review";
            requestBody = { full_syllabus_topics: fullSyllabusTopics, num_questions: parseInt(numQuestions), difficulty: difficulty };
        } else {
            currentTopic = selectedTopicValue;
            requestBody = { topic: currentTopic, num_questions: parseInt(numQuestions), difficulty: difficulty };
        }
        if (!currentTopic || currentTopic === 'Provide syllabus first') { alert('Please select a valid topic!'); return; }
        showLoader(true, 'Generating your quiz with AI...');
        quizSetupContainer.classList.add('hidden');
        try {
            const response = await fetch(`${API_BASE_URL}/generate-quiz`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            quizData = data.quiz;
            displayQuiz(duration); // MODIFIED: Pass duration
        } catch (error) {
            console.error('Error fetching quiz:', error);
            alert('Failed to generate quiz. Please check the backend and try again.');
            showPage('quiz-setup-container');
        } finally { showLoader(false); }
    }
    function displayQuiz(duration) { // MODIFIED: Accept duration
        quizContainer.innerHTML = ''; // Clear previous quiz
        showPage('quiz-container');

        // NEW: Add timer display if duration is set
        if (duration > 0) {
            const timerContainer = document.createElement('div');
            timerContainer.id = 'quiz-timer-display';
            timerContainer.innerHTML = `Time Left: <span id="quiz-timer">${formatTime(duration * 60)}</span>`;
            quizContainer.appendChild(timerContainer);
            startQuizTimer(duration);
        }

        quizData.forEach((questionItem, index) => {
            const questionBlock = document.createElement('div');
            questionBlock.classList.add('question-block');
            questionBlock.innerHTML = `<p class="question-text">${index + 1}. ${questionItem.question}</p>`;
            const optionsGrid = document.createElement('div');
            optionsGrid.classList.add('options-grid');
            questionItem.options.forEach(option => {
                const optionBtn = document.createElement('button');
                optionBtn.classList.add('option-btn');
                optionBtn.textContent = option;
                optionBtn.onclick = () => selectOption(questionItem.id, option, optionBtn);
                optionsGrid.appendChild(optionBtn);
            });
            questionBlock.appendChild(optionsGrid);
            quizContainer.appendChild(questionBlock);
        });
        const submitBtn = document.createElement('button');
        submitBtn.id = 'start-quiz-btn'; // Re-using ID, consider changing to class
        submitBtn.textContent = 'Submit Quiz';
        submitBtn.onclick = calculateAndShowResults;
        quizContainer.appendChild(submitBtn);
    }

    function selectOption(questionId, selectedOption, buttonElement) {
        const question = quizData.find(q => q.id === questionId);
        question.userAnswer = selectedOption;
        const parent = buttonElement.parentElement;
        parent.querySelectorAll('.option-btn').forEach(btn => btn.classList.remove('selected'));
        buttonElement.classList.add('selected');
    }

    // NEW: Quiz Timer Function
    function startQuizTimer(minutes) {
        isQuizSubmitted = false;
        let seconds = minutes * 60;
        const timerDisplay = document.getElementById('quiz-timer'); // Get the span inside
        const timerContainer = document.getElementById('quiz-timer-display');

        if (!timerDisplay || !timerContainer) {
            console.error("Quiz timer elements not found in the dynamically added HTML.");
            return;
        }

        timerContainer.classList.remove('hidden');

        if (quizTimerInterval) {
            clearInterval(quizTimerInterval);
        }

        quizTimerInterval = setInterval(() => {
            if (seconds <= 0) {
                clearInterval(quizTimerInterval);
                timerDisplay.textContent = "Time's up!";
                if (!isQuizSubmitted) {
                    calculateAndShowResults();
                }
            } else {
                seconds--;
                timerDisplay.textContent = formatTime(seconds);
            }
        }, 1000);
    }

    async function calculateAndShowResults() {
        // NEW: Prevent double submission
        if (isQuizSubmitted) {
            return;
        }
        isQuizSubmitted = true;

        // NEW: Stop timer
        if (quizTimerInterval) {
            clearInterval(quizTimerInterval);
            quizTimerInterval = null;
        }
        const timerContainer = document.getElementById('quiz-timer-display');
        if (timerContainer) {
            timerContainer.classList.add('hidden');
        }

        let score = 0;
        const resultsBreakdown = document.getElementById('results-breakdown');
        resultsBreakdown.innerHTML = '';
        let resultsForSummary = [];
        quizData.forEach(item => {
            const isCorrect = item.userAnswer === item.correctAnswer;
            if (isCorrect) score++;
            const resultItem = document.createElement('div');
            resultItem.classList.add('result-item', isCorrect ? 'correct' : 'incorrect');
            resultItem.innerHTML = `<p><strong>Question:</strong> ${item.question}</p><p><strong>Your Answer:</strong> ${item.userAnswer || 'Not answered'}</p>${!isCorrect ? `<p><strong>Correct Answer:</strong> ${item.correctAnswer}</p>` : ''}`;
            resultsBreakdown.appendChild(resultItem);
            resultsForSummary.push({ question: item.question, userAnswer: item.userAnswer, isCorrect: isCorrect });
        });
        document.getElementById('score-text').textContent = `Your Score: ${score} / ${quizData.length}`;
        showPage('results-container');
        fetchVideoSuggestions();
        reportSummary.innerHTML = "<em>Generating AI performance summary...</em>";
        try {
            const response = await fetch(`${API_BASE_URL}/generate-report-summary`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ results: resultsForSummary, topic: currentTopic }) });
            const data = await response.json();
            reportSummary.textContent = data.summary;
            saveReport(score, quizData.length, currentTopic, data.summary, resultsForSummary);
        } catch (error) {
            reportSummary.textContent = "Could not generate AI summary at this time.";
            saveReport(score, quizData.length, currentTopic, "Summary not available.", resultsForSummary);
        }
    }
    function saveReport(score, total, topic, summary, breakdown) {
        const reports = JSON.parse(localStorage.getItem('quizReports')) || [];
        const report = { id: Date.now(), date: new Date().toLocaleDateString(), topic: topic, score: score, total: total, summary: summary, breakdown: breakdown };
        reports.push(report);
        localStorage.setItem('quizReports', JSON.stringify(reports));
    }
    function loadPastReports() {
        const reports = JSON.parse(localStorage.getItem('quizReports')) || [];
        pastReportsList.innerHTML = '';
        if (reports.length === 0) { pastReportsList.innerHTML = '<p>Your past quiz reports will appear here.</p>'; return; }
        reports.reverse().forEach(report => {
            const reportCard = document.createElement('div');
            reportCard.classList.add('report-card');
            reportCard.innerHTML = `<strong>${report.topic}</strong> - ${report.date} - Score: ${report.score}/${report.total}`;
            pastReportsList.appendChild(reportCard);
        });
    }
    async function fetchVideoSuggestions() {
        const videoList = document.getElementById('video-list');
        videoList.innerHTML = '<p>Loading suggestions...</p>';
        try {
            const response = await fetch(`${API_BASE_URL}/get-video-suggestions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic: currentTopic }) });
            if (!response.ok) throw new Error('Failed to fetch suggestions');
            const data = await response.json();
            videoList.innerHTML = '';
            data.suggestions.forEach(suggestion => {
                const link = document.createElement('a');
                link.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(suggestion)}`;
                link.textContent = `▶️ ${suggestion}`;
                link.target = '_blank';
                videoList.appendChild(link);
            });
        } catch (error) { videoList.innerHTML = '<p>Could not load video suggestions.</p>'; }
    }

    // --- Notes Helper Functions ---
    function handleNotesUpload(event) {
        const file = event.target.files[0];
        if (file) {
            notesPdfStatus.textContent = `File selected: "${file.name}"`;
            summarizeBtn.disabled = false;
            expandBtn.disabled = false;
        } else {
            notesPdfStatus.textContent = '';
            summarizeBtn.disabled = true;
            expandBtn.disabled = true;
        }
    }
    async function processNotes(action) {
        const file = notesPdfUpload.files[0];
        if (!file) { alert('Please upload a notes PDF first.'); return; }
        showLoader(true, `AI is ${action}ing your notes...`);
        const formData = new FormData();
        formData.append('notes', file);
        formData.append('action', action);
        try {
            const response = await fetch(`${API_BASE_URL}/process-notes`, { method: 'POST', body: formData });
            if (!response.ok) throw new Error('Failed to process notes.');
            const data = await response.json();
            processedNotesText.textContent = data.processed_text;
            notesOutputContainer.classList.remove('hidden');
            saveNoteToHistory(data.processed_text, file.name, action);
            loadPastNotes();
        } catch (error) { alert(`Error: ${error.message}`); } finally { showLoader(false); }
    }
    function downloadNotesAsPdf() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const text = processedNotesText.textContent;
        const splitText = doc.splitTextToSize(text, 180);
        doc.text(splitText, 10, 10);
        doc.save('generated-notes.pdf');
    }
    function saveNoteToHistory(text, originalFileName, action) {
        const notes = JSON.parse(localStorage.getItem('savedNotes')) || [];
        const note = { id: Date.now(), date: new Date().toLocaleString(), title: `${action.charAt(0).toUpperCase() + action.slice(1)} of ${originalFileName}`, text: text };
        notes.push(note);
        localStorage.setItem('savedNotes', JSON.stringify(notes));
    }
    function loadPastNotes() {
        const notes = JSON.parse(localStorage.getItem('savedNotes')) || [];
        pastNotesList.innerHTML = '';
        if (notes.length === 0) { pastNotesList.innerHTML = '<p>Your past generated notes will appear here.</p>'; return; }
        notes.reverse().forEach(note => {
            const item = document.createElement('div');
            item.classList.add('history-item');
            item.innerHTML = `<span>${note.title} - <small>${note.date}</small></span>`;
            const downloadBtn = document.createElement('button');
            downloadBtn.textContent = 'Download';
            downloadBtn.classList.add('download-history-btn');
            downloadBtn.onclick = () => downloadNoteFromHistory(note.id);
            item.appendChild(downloadBtn);
            pastNotesList.appendChild(item);
        });
    }
    function downloadNoteFromHistory(noteId) {
        const notes = JSON.parse(localStorage.getItem('savedNotes')) || [];
        const note = notes.find(n => n.id === noteId);
        if (note) {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            const splitText = doc.splitTextToSize(note.text, 180);
            doc.text(splitText, 10, 10);
            doc.save(`notes-${note.id}.pdf`);
        }
    }

    // --- Exam Prep Functions ---
    function handleExamSyllabusUpload(event) {
        const file = event.target.files[0];
        if (file) { examSyllabusStatus.textContent = `Syllabus selected: "${file.name}"`; } else { examSyllabusStatus.textContent = ''; }
    }
    async function generateStudyPlan() {
        const examDate = examDateInput.value;
        const syllabusFile = examSyllabusUpload.files[0];
        if (!examDate || !syllabusFile) { alert('Please provide both an exam date and a syllabus PDF.'); return; }
        showLoader(true, 'AI is generating your personalized study plan...');
        const formData = new FormData();
        formData.append('exam_date', examDate);
        formData.append('syllabus', syllabusFile);
        try {
            const response = await fetch(`${API_BASE_URL}/generate-study-plan`, { method: 'POST', body: formData });
            if (!response.ok) throw new Error('Failed to generate study plan.');
            const data = await response.json();
            generatedPlanText = data.plan_text;
            planOutputContainer.classList.remove('hidden');
        } catch (error) { alert(`Error: ${error.message}`); } finally { showLoader(false); }
    }
    function downloadPlanAsPdf() {
        if (!generatedPlanText) return;
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const splitText = doc.splitTextToSize(generatedPlanText, 180);
        doc.text(splitText, 10, 10);
        doc.save('study-plan.pdf');
    }

    // --- Material Suggestion Functions ---
    function handleMaterialPdfUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        materialPdfStatus.textContent = `File ready: "${file.name}"`;
        materialSyllabusInput.value = '';
        materialSyllabusInput.disabled = true;
    }

    async function fetchMaterialSuggestions() {
        const textSyllabus = materialSyllabusInput.value;
        const file = materialSyllabusPdfUpload.files[0];
        if (!textSyllabus && !file) {
            alert('Please provide a syllabus either by text or PDF.');
            return;
        }
        showLoader(true, 'Finding the best materials for you...');
        const formData = new FormData();
        if (file) {
            formData.append('syllabus_file', file);
        } else {
            formData.append('syllabus_text', textSyllabus);
        }
        try {
            const response = await fetch(`${API_BASE_URL}/get-material-suggestions`, { method: 'POST', body: formData });
            if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || 'Failed to fetch suggestions.'); }
            const data = await response.json();
            displaySuggestions(data.materials);
        } catch (error) {
            console.error('Error fetching material suggestions:', error);
            alert(`Error: ${error.message}`);
            suggestionsList.innerHTML = '<p>Could not load suggestions at this time.</p>';
            suggestionsOutputContainer.classList.remove('hidden');
        } finally {
            showLoader(false);
        }
    }

    function displaySuggestions(materials) {
        suggestionsList.innerHTML = '';
        if (!materials || materials.length === 0) {
            suggestionsList.innerHTML = '<p>No specific materials found for this topic.</p>';
        } else {
            materials.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('suggestion-item');
                itemDiv.innerHTML = `
                    <a href="${item.link}" target="_blank" rel="noopener noreferrer">${item.title}</a>
                    <p>${item.description}</p>
                `;
                suggestionsList.appendChild(itemDiv);
            });
        }
        suggestionsOutputContainer.classList.remove('hidden');
    }

    // --- Chatbot Functions ---
    function toggleChatbot() {
        chatbotContainer.classList.toggle('hidden');
        if (!chatbotContainer.classList.contains('hidden')) {
            chatbotInput.focus();
        }
    }

    function appendMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('chat-message', sender);
        messageDiv.textContent = text;
        chatbotMessages.appendChild(messageDiv);
        chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
    }

    async function sendMessage() {
        const userMessage = chatbotInput.value.trim();
        if (!userMessage) return;
        appendMessage(userMessage, 'user');
        chatHistory.push({ role: 'user', text: userMessage });
        chatbotInput.value = '';
        chatbotInput.focus();
        appendMessage('...', 'bot');
        const typingIndicator = chatbotMessages.lastChild;
        try {
            const reports = JSON.parse(localStorage.getItem('quizReports')) || [];
            const performanceData = reports.map(r => ({ topic: r.topic, score: `${r.score}/${r.total}`}));
            const response = await fetch(`${API_BASE_URL}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMessage, history: chatHistory, performance: performanceData })
            });
            if (!response.ok) throw new Error('Failed to get response from chatbot.');
            const data = await response.json();
            const botResponse = data.response;
            typingIndicator.textContent = botResponse;
            chatHistory.push({ role: 'bot', text: botResponse });
        } catch (error) {
            typingIndicator.textContent = 'Sorry, I am having trouble connecting. Please try again.';
            console.error('Chatbot error:', error);
        }
    }

    // --- NEW Concentration Mode Functions ---
    function startConcentrationMode() {
        const duration = parseInt(concentrationDurationInput.value, 10);
        if (isNaN(duration) || duration <= 0) {
            alert("Please enter a valid duration.");
            return;
        }

        let seconds = duration * 60;
        concentrationOverlay.classList.remove('hidden');

        // Request fullscreen
        if (concentrationOverlay.requestFullscreen) {
            concentrationOverlay.requestFullscreen();
        } else if (concentrationOverlay.webkitRequestFullscreen) { /* Safari */
            concentrationOverlay.webkitRequestFullscreen();
        } else if (concentrationOverlay.msRequestFullscreen) { /* IE11 */
            concentrationOverlay.msRequestFullscreen();
        }

        if (concentrationTimerInterval) {
            clearInterval(concentrationTimerInterval);
        }

        concentrationTimer.textContent = formatTime(seconds); // Initial display

        concentrationTimerInterval = setInterval(() => {
            if (seconds <= 0) {
                stopConcentrationMode();
            } else {
                seconds--;
                concentrationTimer.textContent = formatTime(seconds);
            }
        }, 1000);
    }

    function stopConcentrationMode() {
        if (concentrationTimerInterval) {
            clearInterval(concentrationTimerInterval);
            concentrationTimerInterval = null;
        }

        if (document.fullscreenElement) {
            document.exitFullscreen();
        }

        concentrationOverlay.classList.add('hidden');
        showPage('dashboard-container');
    }

    function handleFullscreenChange() {
        // If user exits fullscreen manually (e.g., pressing Esc) and timer is running
        if (!document.fullscreenElement && concentrationTimerInterval) {
            stopConcentrationMode();
        }
    }


    // --- Utility Functions ---
    function showLoader(isVisible, text = 'Loading...') {
        loaderText.textContent = text;
        loader.style.display = isVisible ? 'flex' : 'none';
    }

    function resetQuizSetup() {
        syllabusInput.value = '';
        syllabusPdfUpload.value = '';
        pdfStatus.textContent = '';
        syllabusInput.disabled = false;
        topicSelect.innerHTML = '<option>Provide syllabus first</option>';
        topicSelect.disabled = true;
        startQuizBtn.disabled = true;
        fullSyllabusTopics = [];
        quizDurationInput.value = '0'; // NEW
    }

    function resetMaterialSuggestion() {
        materialSyllabusInput.value = '';
        materialSyllabusPdfUpload.value = '';
        materialPdfStatus.textContent = '';
        materialSyllabusInput.disabled = false;
        suggestionsOutputContainer.classList.add('hidden');
        suggestionsList.innerHTML = '';
    }

    // NEW: Time formatting utility
    function formatTime(totalSeconds) {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    // --- Initial Load ---
    showPage('dashboard-container');
});

