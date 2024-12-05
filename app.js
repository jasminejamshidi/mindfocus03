class NotificationApp {
    constructor() {
        this.enableBtn = document.getElementById('enableBtn');
        this.status = document.getElementById('status');

        // Toggle switches
        this.waterToggle = document.getElementById('waterToggle');
        this.keysToggle = document.getElementById('keysToggle');

        // Sound thresholds and timers
        this.lastWaterNotification = 0;
        this.lastDoorNotification = 0;
        this.notificationCooldown = 60000; // 1 minute cooldown

        // Manual reminder elements
        this.reminderTitle = document.getElementById('reminderTitle');
        this.reminderMessage = document.getElementById('reminderMessage');
        this.reminderTime = document.getElementById('reminderTime');
        this.reminderRepeat = document.getElementById('reminderRepeat');
        this.addReminderBtn = document.getElementById('addReminderBtn');
        this.remindersList = document.getElementById('remindersList');

        // Store reminders
        this.reminders = JSON.parse(localStorage.getItem('reminders') || '[]');

        // Action buttons
        this.deleteAllBtn = document.querySelector('.delete-all-btn');
        this.addNewBtn = document.querySelector('.add-reminder-btn');

        // Editing state
        this.editingReminderId = null;

        // Volume meter elements
        this.volumeMeterContainer = document.querySelector('.volume-meter-container');
        this.volumeBar = document.querySelector('.volume-bar');
        this.volumeMeter = document.querySelector('.volume-meter');

        // Audio recognition properties
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.audioStream = null;
        this.audioAnalyser = null;
        this.isListening = true;

        // Teachable Machine models
        this.waterModel = null;
        this.keysModel = null;
        this.isModelLoading = false;

        this.init();
        this.initAudio();
        this.loadTeachableModels();
        this.initReminders();
        this.initQuickReminders();
        this.initActionButtons();
        this.initTestNotifications();

        // Request notification permission if not already granted
        if (Notification.permission !== 'granted') {
            this.requestPermission();
        }
    }

    init() {
        // Check if browser supports notifications
        if (!('Notification' in window)) {
            this.showStatus('This browser does not support notifications', 'error');
            return;
        }

        // Add event listeners
        this.enableBtn.addEventListener('click', () => this.requestPermission());

        // Resume audio context on user interaction
        document.addEventListener('click', () => {
            this.resumeAudioContext();
        }, { once: true });

        // Check initial permission status
        this.checkPermissionStatus();
    }

    checkPermissionStatus() {
        const permission = Notification.permission;
        console.log('Current permission status:', permission);
        
        if (permission === 'granted') {
            this.enableBtn.style.display = 'none';
            this.showStatus('Notifications enabled!', 'success');
        } else if (permission === 'denied') {
            this.showStatus('Notifications are blocked. Please enable them in your browser settings.', 'error');
        }
    }

    async requestPermission() {
        try {
            console.log('Requesting permission...');
            const permission = await Notification.requestPermission();
            console.log('Permission result:', permission);
            
            if (permission === 'granted') {
                this.enableBtn.style.display = 'none';
                this.showStatus('Notifications enabled!', 'success');
            } else {
                this.showStatus('Permission denied. Please enable notifications.', 'error');
            }
        } catch (error) {
            console.error('Error requesting permission:', error);
            this.showStatus('Error requesting permission', 'error');
        }
    }

    handleWaterSound() {
        const now = Date.now();
        if (this.waterToggle.checked && now - this.lastWaterNotification > this.notificationCooldown) {
            console.log('Water sound detected - sending notification');
            this.sendNotification('Hydration Reminder', 'Time to drink water!');
            this.lastWaterNotification = now;
            this.showStatus('Water reminder sent!', 'success');
        }
    }

    handleDoorSound() {
        const now = Date.now();
        if (this.keysToggle.checked && now - this.lastDoorNotification > this.notificationCooldown) {
            console.log('Door sound detected - sending notification');
            this.sendNotification('Keys Reminder', 'Don\'t forget your keys!');
            this.lastDoorNotification = now;
            this.showStatus('Keys reminder sent!', 'success');
        }
    }

    // Modify existing sendNotification method to accept parameters
    sendNotification(title, message) {
        try {
            if (Notification.permission === 'granted') {
                console.log('Sending notification:', { title, message });

                // Determine notification type
                const type = title.toLowerCase().includes('water') ? 'water' : 'keys';

                // Create system notification
                const notification = new Notification(title, {
                    body: message,
                    icon: type === 'water' ? 'https://example.com/water-icon.png' : 'https://example.com/keys-icon.png',
                    vibrate: [200, 100, 200],
                    requireInteraction: true,
                    tag: Date.now().toString(),
                    dir: 'auto',
                    silent: false
                });

                notification.onclick = () => {
                    window.focus();
                    notification.close();
                };

                // Add notification event handlers
                notification.onshow = () => {
                    console.log('Notification shown');
                    this.playNotificationSound();
                };
                
                notification.onerror = (error) => {
                    console.error('Notification error:', error);
                };

                // Show in-app notification as fallback
                this.showInAppNotification(title, message);

                console.log('Notification sent successfully');
            } else {
                console.warn('Notifications not granted');
                this.showStatus('Please enable notifications', 'error');
                // Show in-app notification as fallback
                this.showInAppNotification(title, message);
            }
        } catch (error) {
            console.error('Error sending notification:', error);
            this.showStatus('Failed to send notification', 'error');
            // Show in-app notification as fallback
            this.showInAppNotification(title, message);
        }
    }

    showInAppNotification(title, message) {
        let notificationContainer = document.getElementById('notification-container');
        if (!notificationContainer) {
            notificationContainer = document.createElement('div');
            notificationContainer.id = 'notification-container';
            document.body.appendChild(notificationContainer);
        }

        const notification = document.createElement('div');
        const type = title.toLowerCase().includes('water') ? 'water' : 'keys';
        notification.className = `in-app-notification ${type}`;
        const icon = type === 'water' ? '💧' : '🔑';
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        notification.innerHTML = `
            <div class="notification-header">
                <div class="notification-title">
                    <span class="notification-icon">${icon}</span>
                    <h4>${title}</h4>
                    <span class="notification-time">${time}</span>
                </div>
                <button class="close-btn">&times;</button>
            </div>
            <p>${message}</p>
        `;

        // Play notification sound
        this.playNotificationSound();

        // Add to container at the beginning
        notificationContainer.insertBefore(notification, notificationContainer.firstChild);

        // Add entrance animation
        notification.classList.add('notification-enter');

        // Add close button functionality
        const closeBtn = notification.querySelector('.close-btn');
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        };

        // Make notification dismissible by clicking
        notification.addEventListener('click', () => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
            window.focus();
        });

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.classList.add('fade-out');
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
    }

    showStatus(message, type) {
        console.log(`Status: ${message} (${type})`);
        this.status.textContent = message;
        this.status.className = `status ${type}`;
        setTimeout(() => {
            this.status.className = 'status';
        }, 3000);
    }

    playNotificationSound() {
        try {
            const audio = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgA');
            audio.volume = 0.5;
            audio.play().catch(error => console.log('Audio play failed:', error));
        } catch (error) {
            console.error('Error playing sound:', error);
        }
    }

    initReminders() {
        // Add event listener for adding reminders
        this.addReminderBtn.addEventListener('click', () => this.addReminder());

        // Load saved reminders
        this.loadReminders();

        // Start checking reminders
        this.checkReminders();
    }

    addReminder() {
        const title = this.reminderTitle.value.trim();
        const message = this.reminderMessage.value.trim();
        const time = this.reminderTime.value;
        const repeat = this.reminderRepeat.value;

        if (!title || !message || !time) {
            this.showStatus('Please fill in all fields', 'error');
            return;
        }

        if (this.editingReminderId) {
            // Update existing reminder
            const index = this.reminders.findIndex(r => r.id === this.editingReminderId);
            if (index !== -1) {
                this.reminders[index] = {
                    ...this.reminders[index],
                    title,
                    message,
                    time,
                    repeat,
                    nextTrigger: this.calculateNextTrigger(time)
                };
                this.showStatus('Reminder updated successfully', 'success');
            }
            
            // Reset edit mode
            this.editingReminderId = null;
            this.addReminderBtn.textContent = 'Add Reminder';
            this.addReminderBtn.classList.remove('updating');
        } else {
            // Add new reminder
            const reminder = {
                id: Date.now(),
                title,
                message,
                time,
                repeat,
                nextTrigger: this.calculateNextTrigger(time)
            };

            this.reminders.push(reminder);
            this.showStatus('Reminder added successfully', 'success');
        }

        this.saveReminders();
        this.displayReminders();
        this.clearReminderForm();
    }

    calculateNextTrigger(time) {
        const [hours, minutes] = time.split(':');
        const now = new Date();
        const trigger = new Date();
        trigger.setHours(parseInt(hours), parseInt(minutes), 0, 0);

        if (trigger <= now) {
            trigger.setDate(trigger.getDate() + 1);
        }

        return trigger.getTime();
    }

    loadReminders() {
        this.displayReminders();
    }

    displayReminders() {
        this.remindersList.innerHTML = '';
        this.reminders.forEach(reminder => {
            const div = document.createElement('div');
            div.className = 'reminder-item';
            div.innerHTML = `
                <div class="reminder-item-content">
                    <h4>${reminder.title}</h4>
                    <p>${reminder.message}</p>
                    <div class="reminder-time-display">
                        ${reminder.time} (${reminder.repeat})
                    </div>
                </div>
                <div class="reminder-actions">
                    <button class="edit-reminder" data-id="${reminder.id}" title="Edit Reminder">
                        <span class="icon">✏️</span>
                    </button>
                    <button class="delete-reminder" data-id="${reminder.id}" title="Delete Reminder">
                        <span class="icon">🗑️</span>
                    </button>
                </div>
            `;

            // Add edit functionality
            div.querySelector('.edit-reminder').addEventListener('click', () => {
                this.editReminder(reminder);
            });

            div.querySelector('.delete-reminder').addEventListener('click', () => {
                this.deleteReminder(reminder.id);
            });

            this.remindersList.appendChild(div);
        });
    }

    deleteReminder(id) {
        this.reminders = this.reminders.filter(r => r.id !== id);
        this.saveReminders();
        this.displayReminders();
        this.showStatus('Reminder deleted', 'success');
    }

    saveReminders() {
        localStorage.setItem('reminders', JSON.stringify(this.reminders));
    }

    clearReminderForm() {
        this.reminderTitle.value = '';
        this.reminderMessage.value = '';
        this.reminderTime.value = '';
        this.reminderRepeat.value = 'once';
    }

    checkReminders() {
        setInterval(() => {
            const now = Date.now();
            this.reminders.forEach(reminder => {
                if (now >= reminder.nextTrigger) {
                    this.sendNotification(reminder.title, reminder.message);
                    
                    // Update next trigger based on repeat setting
                    switch (reminder.repeat) {
                        case 'daily':
                            reminder.nextTrigger += 24 * 60 * 60 * 1000;
                            break;
                        case 'weekly':
                            reminder.nextTrigger += 7 * 24 * 60 * 60 * 1000;
                            break;
                        case 'once':
                            this.deleteReminder(reminder.id);
                            return;
                    }
                }
            });
            this.saveReminders();
        }, 60000); // Check every minute
    }

    initQuickReminders() {
        const quickButtons = document.querySelectorAll('.quick-reminder-btn');
        quickButtons.forEach(button => {
            button.addEventListener('click', () => {
                const title = button.dataset.title;
                const message = button.dataset.message;
                
                // Add visual feedback
                button.classList.add('active');
                setTimeout(() => button.classList.remove('active'), 200);

                // Show quick reminder dialog
                this.showQuickReminderDialog(title, message);
            });
        });
    }

    showQuickReminderDialog(title, message) {
        // Create and show a modal for setting the reminder time
        const modal = document.createElement('div');
        modal.className = 'quick-reminder-modal';
        modal.innerHTML = `
            <div class="quick-reminder-modal-content">
                <h4>${title}</h4>
                <p>${message}</p>
                <div class="quick-reminder-options">
                    <button class="remind-option" data-minutes="0">Now</button>
                    <button class="remind-option" data-minutes="15">15 min</button>
                    <button class="remind-option" data-minutes="30">30 min</button>
                    <button class="remind-option" data-minutes="60">1 hour</button>
                </div>
                <button class="close-modal">Cancel</button>
            </div>
        `;

        document.body.appendChild(modal);

        // Add event listeners for the options
        modal.querySelectorAll('.remind-option').forEach(button => {
            button.addEventListener('click', () => {
                const minutes = parseInt(button.dataset.minutes);
                this.createQuickReminder(title, message, minutes);
                modal.remove();
            });
        });

        // Add close functionality
        modal.querySelector('.close-modal').addEventListener('click', () => {
            modal.remove();
        });

        // Close when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    createQuickReminder(title, message, minutes) {
        const now = new Date();
        const triggerTime = new Date(now.getTime() + minutes * 60000);
        
        const reminder = {
            id: Date.now(),
            title,
            message,
            time: triggerTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            repeat: 'once',
            nextTrigger: triggerTime.getTime()
        };

        if (minutes === 0) {
            // Send notification immediately
            this.sendNotification(title, message);
        } else {
            // Add to reminders list
            this.reminders.push(reminder);
            this.saveReminders();
            this.displayReminders();
            this.showStatus(`Reminder set for ${minutes} minutes from now`, 'success');
        }
    }

    initActionButtons() {
        // Delete all reminders button
        this.deleteAllBtn.addEventListener('click', () => {
            if (this.reminders.length === 0) {
                this.showStatus('No reminders to delete', 'info');
                return;
            }
            this.showConfirmDialog(
                'Delete All Reminders',
                'Are you sure you want to delete all reminders? This action cannot be undone.',
                () => {
                    this.reminders = [];
                    this.saveReminders();
                    this.displayReminders();
                    this.showStatus('All reminders deleted', 'success');
                }
            );
        });

        // Add new reminder button
        this.addNewBtn.addEventListener('click', () => {
            // Show/focus the reminder form
            this.reminderTitle.focus();
            this.reminderTitle.scrollIntoView({ behavior: 'smooth' });
        });
    }

    showConfirmDialog(title, message, onConfirm) {
        const modal = document.createElement('div');
        modal.className = 'confirm-modal';
        modal.innerHTML = `
            <div class="confirm-modal-content">
                <h4>${title}</h4>
                <p>${message}</p>
                <div class="confirm-modal-actions">
                    <button class="confirm-btn confirm">Delete All</button>
                    <button class="confirm-btn cancel">Cancel</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add event listeners
        const confirmBtn = modal.querySelector('.confirm');
        const cancelBtn = modal.querySelector('.cancel');

        confirmBtn.addEventListener('click', () => {
            onConfirm();
            modal.remove();
        });

        cancelBtn.addEventListener('click', () => {
            modal.remove();
        });

        // Close when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    editReminder(reminder) {
        // Fill form with reminder data
        this.reminderTitle.value = reminder.title;
        this.reminderMessage.value = reminder.message;
        this.reminderTime.value = reminder.time;
        this.reminderRepeat.value = reminder.repeat;

        // Change add button to update button
        this.addReminderBtn.textContent = 'Update Reminder';
        this.addReminderBtn.classList.add('updating');
        
        // Store the reminder being edited
        this.editingReminderId = reminder.id;

        // Scroll to form
        this.reminderTitle.scrollIntoView({ behavior: 'smooth' });
        this.reminderTitle.focus();
    }

    async loadTeachableModels() {
        try {
            this.isModelLoading = true;
            this.showStatus('Loading sound detection models...', 'info');

            // Load water detection model
            const waterModelURL = 'https://teachablemachine.withgoogle.com/models/_Coz4j71s/';
            this.waterModel = await this.createModel(waterModelURL);
            console.log('Water model loaded');

            // Load keys/door detection model
            const keysModelURL = 'https://teachablemachine.withgoogle.com/models/gUkFNF56C/';
            this.keysModel = await this.createModel(keysModelURL);
            console.log('Keys model loaded');

            this.isModelLoading = false;
            this.showStatus('Sound detection models loaded!', 'success');
            this.startSoundDetection();
        } catch (error) {
            console.error('Error loading models:', error);
            this.showStatus('Failed to load sound detection models', 'error');
        }
    }

    async createModel(modelURL) {
        const checkpointURL = modelURL + "model.json";
        const metadataURL = modelURL + "metadata.json";

        const recognizer = speechCommands.create(
            "BROWSER_FFT",
            undefined,
            checkpointURL,
            metadataURL
        );

        await recognizer.ensureModelLoaded();
        return recognizer;
    }

    async startSoundDetection() {
        try {
            // Request microphone permission
            this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Create audio context and analyzer
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = this.audioContext.createMediaStreamSource(this.audioStream);
            
            // Create analyzer node for volume meter
            this.audioAnalyser = this.audioContext.createAnalyser();
            this.audioAnalyser.fftSize = 256;
            source.connect(this.audioAnalyser);
            
            // Start volume meter animation
            this.updateVolumeMeter();

            // Start listening with water model
            this.waterModel.listen(
                result => {
                    if (result.scores[1] > 0.8) {  // Water sound detected
                        this.handleWaterSound();
                    }
                },
                {
                    includeSpectrogram: true,
                    probabilityThreshold: 0.75,
                    invokeCallbackOnNoiseAndUnknown: true,
                    overlapFactor: 0.50
                }
            );

            // Start listening with keys model
            this.keysModel.listen(
                result => {
                    if (result.scores[1] > 0.8) {  // Door sound detected
                        this.handleDoorSound();
                    }
                },
                {
                    includeSpectrogram: true,
                    probabilityThreshold: 0.75,
                    invokeCallbackOnNoiseAndUnknown: true,
                    overlapFactor: 0.50
                }
            );

            this.showStatus('Sound detection active', 'success');
        } catch (error) {
            console.error('Error starting sound detection:', error);
            this.showStatus('Error accessing microphone', 'error');
        }
    }

    updateVolumeMeter() {
        if (!this.audioAnalyser || !this.volumeBar) {
            requestAnimationFrame(() => this.updateVolumeMeter());
            return;
        }

        const dataArray = new Uint8Array(this.audioAnalyser.frequencyBinCount);
        this.audioAnalyser.getByteFrequencyData(dataArray);

        // Calculate volume level (0-100)
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        const volume = Math.min(100, Math.round((average / 128) * 150));  // Increased sensitivity

        // Update volume bar
        this.volumeBar.style.width = `${volume}%`;
            
        // Add visual feedback based on volume level
        if (volume > 20) {  // Lower threshold for better feedback
            this.volumeMeter.classList.add('detecting');
        } else {
            this.volumeMeter.classList.remove('detecting');
        }

        // Continue animation
        requestAnimationFrame(() => this.updateVolumeMeter());
    }

    initTestNotifications() {
        // Simulate sound detection every 10 seconds
        setInterval(() => {
            // Alternate between water and door sounds
            const now = Date.now();
            if (now % 20000 < 10000) { // Every 20 seconds, first 10 seconds
                console.log('Testing water sound detection...');
                this.handleWaterSound();
            } else { // Every 20 seconds, second 10 seconds
                console.log('Testing door sound detection...');
                this.handleDoorSound();
            }
        }, 10000); // Run every 10 seconds
    }

    async initAudio() {
        try {
            // Request microphone permission
            this.audioStream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            
            // Create audio source and analyzer
            const source = this.audioContext.createMediaStreamSource(this.audioStream);
            this.audioAnalyser = this.audioContext.createAnalyser();
            this.audioAnalyser.fftSize = 1024;  // Increased for better resolution
            this.audioAnalyser.smoothingTimeConstant = 0.8;  // Smoother transitions
            source.connect(this.audioAnalyser);
            
            // Start volume meter animation
            this.updateVolumeMeter();
            
            this.showStatus('Microphone connected', 'success');
        } catch (error) {
            console.error('Error initializing audio:', error);
            this.showStatus('Error accessing microphone', 'error');
        }
    }

    async resumeAudioContext() {
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new NotificationApp();
});