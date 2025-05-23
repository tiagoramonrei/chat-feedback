// Prevent pinch-zoom on iOS
document.addEventListener('touchstart', function(event) {
    if (event.touches.length > 1) {
        event.preventDefault();
    }
}, { passive: false });

document.addEventListener('touchmove', function(event) {
    if (event.touches.length > 1) {
        event.preventDefault();
    }
}, { passive: false });

// Add a simple check to prevent double-tap zoom, might interfere with legitimate double taps
let lastTouchEnd = 0;
document.addEventListener('touchend', function(event) {
    const now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
        event.preventDefault();
    }
    lastTouchEnd = now;
}, false);

document.addEventListener('DOMContentLoaded', () => {
    const chatContent = document.querySelector('.basecontent');
    const userInput = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');
    const footer = document.querySelector('.footer');

    let currentStep = 0;
    let awaitingElaboration = false; // Flag for short answer follow-up
    const minResponseLength = 25; // Minimum characters for a non-short answer

    const chatSteps = [
        // Step 0: Initial messages from Rei
        {
            messages: [
                { sender: 'rei', text: 'Olá, como você está?' },
                { sender: 'rei', text: 'Queremos muito saber a sua opinião.' },
                { sender: 'rei', text: 'Nos diga, o que você está achando da sua experiência no aplicativo e site do Rei do Pitaco?', isQuestion: true }
            ],
            expectsInput: true,
            inputType: 'text'
        },
        // Step 1: User replies, Rei asks about promotions
        {
            messages: [
                { sender: 'rei', text: 'E me diz uma coisa:' },
                { sender: 'rei', text: 'Você costuma participar das nossas promoções, tipo o Clube da Realeza ou o Retorno do Rei?' },
                { sender: 'rei', text: 'O que você acha delas?' , isQuestion: true }
            ],
            expectsInput: true,
            inputType: 'text'
        },
        // Step 2: User replies, Rei asks about feeling if service was unavailable
        {
            messages: [
                { sender: 'rei', text: 'Agora, uma perguntinha rápida.' },
                { sender: 'rei', text: 'Como você se sentiria se não pudesse mais usar o Rei do Pitaco?', isQuestion: true },
            ],
            expectsInput: true,
            inputType: 'text'
        },
        // Step 3: User replies, Rei asks for rating
        {
            messages: [
                { sender: 'rei', text: 'Certo.' },
                { sender: 'rei', text: 'Se tivesse que dar uma nota de 0 a 10, sendo 0 muito ruim e 10 muito bom, qual nota você daria para sua experiência no Rei do Pitaco? Coloque apenas o número.', isQuestion: true }
            ],
            expectsInput: true,
            inputType: 'number'
        },
        // Step 4: User replies (rating), Rei thanks and ends (Messages handled dynamically)
        {
            messages: [], // Messages are now dynamically set based on rating
            expectsInput: false,
            hideFooter: true // Still need this flag for processStep logic if it were called, but displayFinalMessages handles footer now.
        }
    ];

    function disableInput() {
        userInput.disabled = true;
        sendButton.disabled = true;
    }

    function enableInput(inputType = 'text') {
        userInput.type = inputType;
        userInput.placeholder = inputType === 'number' ? 'Digite apenas números' : 'Digite aqui';

        if (inputType === 'number') {
            userInput.inputMode = 'numeric';
            userInput.pattern = '[0-9]*';
        } else {
            userInput.removeAttribute('inputmode');
            userInput.removeAttribute('pattern');
        }

        userInput.disabled = false;
        sendButton.disabled = false;
        userInput.focus();
    }

    function addMessage(sender, text, initialContent = null) {
        const lastMessageElement = chatContent.lastElementChild;
        let lastSender = null;
        if (lastMessageElement) {
            lastSender = lastMessageElement.classList.contains('baserei') ? 'rei' : 'user';
        }
        const showIcon = sender !== lastSender;

        const messageBase = document.createElement('div');
        const messageContent = document.createElement('div');
        const messageBubble = document.createElement('div');
        const icon = document.createElement('img');

        messageBubble.textContent = text;

        if (sender === 'rei') {
            messageBase.className = 'baserei';
            icon.src = 'https://cdn.prod.website-files.com/67f6fb8ae7a62f40717e9500/67f6fc4b39f3441d240cedc6_icone-msg-rei.svg';
            icon.alt = 'Mensagem Rei do Pitaco';
            icon.className = 'iconrei';
            messageContent.className = 'basemsgrei';
            messageBubble.className = 'msgrei';
            messageContent.appendChild(messageBubble);
            messageBase.appendChild(icon);
            messageBase.appendChild(messageContent);
        } else {
            messageBase.className = 'baseusuario';
            icon.src = 'https://cdn.prod.website-files.com/67f6fb8ae7a62f40717e9500/67f6fc4b9e7f52c0fe791f02_icone-msg-usuario.svg';
            icon.alt = 'Mensagem do Usuário';
            icon.className = 'iconusuario';
            messageContent.className = 'basemsgusuario';
            messageBubble.className = 'msgusuario';
            messageContent.appendChild(messageBubble);
            messageBase.appendChild(messageContent); // Message content first for user
            messageBase.appendChild(icon);
        }

        // Add class to hide icon if it's a consecutive message from the same sender
        if (!showIcon) {
            messageBase.classList.add('no-icon');
        }

        // Use innerHTML to render potential <br> tags for line breaks
        messageBubble.innerHTML = initialContent || text; // Use initialContent if provided

        chatContent.appendChild(messageBase);

        // Trigger reflow to apply initial styles before transition
        void messageBase.offsetWidth;

        // Add class to trigger transition
        messageBase.classList.add('visible');

        // Scroll to the bottom
        chatContent.scrollTop = chatContent.scrollHeight;
        // Use timeout for secondary scroll after potential layout shifts
        setTimeout(() => {
             window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        }, 100);

        // Return the bubble element so it can be updated
        return messageBubble;
    }

    async function processStep(stepIndex) {
        if (stepIndex >= chatSteps.length) return; // End of chat

        const step = chatSteps[stepIndex];
        disableInput();

        for (let i = 0; i < step.messages.length; i++) {
            const msg = step.messages[i];
            // Add a delay before showing each message, slightly longer for questions
            const delay = i === 0 ? 500 : (msg.isQuestion ? 1500 : 1000);
            await new Promise(resolve => setTimeout(resolve, delay));

            if (msg.sender === 'rei') {
                const typingDuration = 2000;
                // 1. Add message with typing indicator
                const reiBubble = addMessage('rei', '', '<span class="typing-indicator"><span></span></span>');

                // 2. Wait for typing duration
                await new Promise(resolve => setTimeout(resolve, typingDuration));

                // 3. Update bubble with actual text using fade-in on a span
                // Wrap the final text in a span for targeted fade-in
                reiBubble.innerHTML = `<span class="fade-in-content content-hidden">${msg.text}</span>`;

                // Find the newly added span
                const textSpan = reiBubble.querySelector('.fade-in-content');

                // Allow browser to render hidden state before removing class for transition
                if (textSpan) { // Check if span exists
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => { // Double request ensures transition
                            textSpan.classList.remove('content-hidden');
                        });
                    });
                } else {
                    // Fallback if span wasn't found (shouldn't happen)
                    reiBubble.innerHTML = msg.text;
                }

                // Optional: Scroll again in case text wrap changes height
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });

            } else { // Should not happen with current steps, but safe fallback
                 addMessage(msg.sender, msg.text);
            }

            // If this is the last message of the step and it expects input, enable it
            if (i === step.messages.length - 1 && step.expectsInput) {
                 await new Promise(resolve => setTimeout(resolve, 500)); // Short delay before enabling
                 enableInput(step.inputType);
            }
        }

        if (step.hideFooter) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait after last message
            footer.classList.add('footer-hidden'); // Add class for fade-out
        }
    }

    // New function to display final messages
    async function displayFinalMessages(messages) {
        disableInput();

        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            const delay = i === 0 ? 500 : 1000; // Delay between final messages
            await new Promise(resolve => setTimeout(resolve, delay));

            // Re-use typing indicator logic
            if (msg.sender === 'rei') { // Should always be rei for final messages
                const typingDuration = 1500; // Typing duration for final messages
                const reiBubble = addMessage('rei', '', '<span class="typing-indicator"><span></span></span>');
                await new Promise(resolve => setTimeout(resolve, typingDuration));
                reiBubble.innerHTML = `<span class="fade-in-content content-hidden">${msg.text}</span>`;
                const textSpan = reiBubble.querySelector('.fade-in-content');
                if (textSpan) {
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => { textSpan.classList.remove('content-hidden'); });
                    });
                }
                 window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            }
        }

        // Hide footer after messages
        await new Promise(resolve => setTimeout(resolve, 1000));
        footer.classList.add('footer-hidden');
    }

    function handleSend() {
        const text = userInput.value.trim();
        if (!text) return;

        const processedText = text.replace(/\n/g, '<br>');
        addMessage('user', processedText);
        userInput.value = '';
        userInput.style.height = 'auto';
        disableInput(); // Disable input immediately after sending

        const currentStepConfig = chatSteps[currentStep];

        // --- Short Answer Check --- START ---
        if (awaitingElaboration) {
            // User just provided the elaboration
            awaitingElaboration = false; // Reset flag
            // Now proceed to the original next step
            currentStep++;
            processStep(currentStep);
        } else if ((currentStep === 0 || currentStep === 1 || currentStep === 2) && text.length < minResponseLength) {
            // It's the first, second or third question and the answer is short
            awaitingElaboration = true; // Set flag

            // Ask for elaboration with typing indicator
            setTimeout(async () => { // Make callback async
                const typingDuration = 1500; // Adjust duration as needed
                const elaborationText = 'Entendi. Poderia detalhar um pouco mais? Sua opinião completa é muito importante.';

                // 1. Add message with typing indicator
                const reiBubble = addMessage('rei', '', '<span class="typing-indicator"><span></span></span>');

                // 2. Wait for typing duration
                await new Promise(resolve => setTimeout(resolve, typingDuration));

                // 3. Update bubble with actual text using fade-in
                reiBubble.innerHTML = `<span class="fade-in-content content-hidden">${elaborationText}</span>`;
                const textSpan = reiBubble.querySelector('.fade-in-content');
                if (textSpan) {
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            textSpan.classList.remove('content-hidden');
                        });
                    });
                }

                // Scroll and enable input after text appears
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                enableInput(currentStepConfig.inputType);
            }, 750); // 750ms delay before starting the animation

            // Don't proceed to the next step yet, wait for elaboration
            return;
        } else {
             // Normal flow or rating step
            if (currentStep === 3) { // Rating step submission
                 // --- Rating Input Validation --- (Handles number format and range)
                 if (!/^[0-9]+$/.test(text)) {
                     alert('Por favor, insira apenas números.');
                     enableInput(currentStepConfig.inputType); // Re-enable if invalid
                     return;
                 }
                 const rating = parseInt(text, 10);
                 if (rating < 0 || rating > 10) {
                      alert('Por favor, insira um número entre 0 e 10.');
                      enableInput(currentStepConfig.inputType); // Re-enable if invalid
                      return;
                 }
                 // --- End Validation ---

                 let finalMessages = [];

                 if (rating <= 6) { // 0-6
                     finalMessages = [
                         { sender: 'rei', text: 'Valeu por contar como tá sendo sua experiência.' },
                         { sender: 'rei', text: 'A gente tá ouvindo tudo pra melhorar cada vez mais.' }
                     ];
                 } else if (rating <= 8) { // 7-8
                     finalMessages = [
                         { sender: 'rei', text: 'Obrigado por contar o que achou!' },
                         { sender: 'rei', text: 'Estamos felizes que você esteja gostando. Ouvir você nos faz melhorar cada vez mais.' } // Corrected grammar
                     ];
                 } else { // 9-10
                     finalMessages = [
                         { sender: 'rei', text: 'Valeu demais por trocar essa ideia com a gente!' },
                         { sender: 'rei', text: 'É demais saber que você curte tanto o Rei do Pitaco! Valeu por estar com a gente nessa jornada! 👑' }
                     ];
                 }

                 // Display final messages and end chat
                 displayFinalMessages(finalMessages);
                 currentStep++; // Advance step index
                 return; // Stop handleSend here

             } else {
                 // Proceed to the next step (for steps 0, 1, 2)
                currentStep++;
                processStep(currentStep);
             }
        }
        // --- Short Answer Check --- END ---
    }

    sendButton.addEventListener('click', handleSend);

    // Add real-time number validation
    userInput.addEventListener('input', () => {
        let value = userInput.value;
        let needsUpdate = false;

        // Check if current step requires number input
        const currentStepConfig = chatSteps[currentStep];
        if (currentStepConfig?.inputType === 'number') {
            // 1. Remove non-digits
            const numericValue = value.replace(/[^0-9]/g, '');

            // 2. Check range (0-10)
            let validatedValue = numericValue;
            if (numericValue !== '') {
                const num = parseInt(numericValue, 10);
                if (num > 10) {
                    validatedValue = '10'; // Cap at 10
                }
            }

            // 3. Update if value changed
            if (value !== validatedValue) {
                value = validatedValue;
                needsUpdate = true;
            }
        }

        // 4. Apply update if needed
        if (needsUpdate) {
            userInput.value = value;
        }
    });

    // Start the chat
    processStep(currentStep);
});
