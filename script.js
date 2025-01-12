document.addEventListener('DOMContentLoaded', async () => {  
    const chatWindow = document.getElementById('chat-window');  
    const userInput = document.getElementById('user-input');  
    const sendButton = document.getElementById('send-button');  
    const imageUpload = document.getElementById('image-upload');  
    const modal = document.getElementById('image-modal');  
    const enlargedImg = document.getElementById('enlarged-img');  
    const downloadLink = document.getElementById('download-link');  
    const closeModalButton = document.querySelector('.close');  
    const showRecommendationsCheckbox = document.getElementById('show-recommendations');  
    const recommendationsDiv = document.getElementById('recommendations');  
    const scrollUpButton = document.getElementById('scroll-up-button');  
    const addPromptButton = document.getElementById('add-prompt-button');

  
    const azureEndpoint = "https://afs.openai.azure.com/";  
    const apiKey = "a9c9ed4ede724626a6bfddff2c717817";  
    const apiVersion = "2024-10-01-preview";  
    const model = "gpt-4o-mini";  
    const IMAGE_GENERATION_URL = "https://afsimage.azurewebsites.net/api/httpTriggerts";  
  
    let messages = [];  
    let finalPrompt = null;  
    let selectedPrompt = null;  
    let awaitingFollowupResponse = false;  
    let awaitingImageExplanation = false;  
    let dynamicChatActive = false;  
    let dynamicChatQuestionCount = 0;  
  
    const QUESTION_TOPICS = ["colors", "textures", "shapes", "lighting", "depth", "style"];  
  
    document.querySelectorAll('.category-heading').forEach(heading => {  
        heading.addEventListener('click', () => {  
            toggleCategory(heading.dataset.category);  
        });  
    });  
  
    function toggleCategory(categoryId) {  
        const categoryElement = document.getElementById(categoryId);  
        if (categoryElement) {  
            categoryElement.style.display = categoryElement.style.display === 'none' ? 'block' : 'none';  
        }  
    }  

    const newSessionButton = document.getElementById('new-session-button');  
    newSessionButton.addEventListener('click', () => {  
        location.reload();  
    });  
  
    document.querySelectorAll('.prompt-list li').forEach(item => {  
        item.addEventListener('click', () => {  
            const promptTitle = item.getAttribute('data-prompt-title');  
            const promptDescription = item.getAttribute('data-prompt-description');  
            if (promptTitle && promptDescription) {  
                selectPrompt(promptDescription);  
            }  
        });  
    });  
  
    function selectPrompt(promptDescription) {  
        selectedPrompt = promptDescription;  
        addMessage("assistant", `Selected prompt: "${promptDescription}". How would you like to alter this prompt?`);  
        awaitingFollowupResponse = true;  
    }  
  
    function openModal(imgSrc) {  
        modal.style.display = 'block';  
        enlargedImg.src = imgSrc;  
        downloadLink.href = imgSrc;  
    }  
  
    function closeModal() {  
        modal.style.display = 'none';  
    }  
  
    function addMessage(role, content, isHTML = false) {  
        const messageElement = document.createElement('div');  
        messageElement.className = role === "user" ? 'message user-message' : 'message assistant-message';  
  
        const messageContent = document.createElement('div');  
        messageContent.className = 'message-content';  
  
        if (isHTML) {  
            messageContent.innerHTML = content; // Use innerHTML for HTML content  
        } else {  
            messageContent.textContent = content; // Use textContent for plain text  
        }  
  
        if (role === "assistant") {  
            const icon = document.createElement('i');  
            icon.className = 'fa-solid fa-palette message-icon';  
            messageElement.appendChild(icon);  
        }  
  
        messageElement.appendChild(messageContent);  
        chatWindow.appendChild(messageElement);  
        chatWindow.scrollTop = chatWindow.scrollHeight;  
  
        messages.push({ role, content });  
    }  
  
    // Display the button when scrolled down 100px  
    chatWindow.addEventListener('scroll', () => {  
        if (chatWindow.scrollTop > 100) {  
            scrollUpButton.style.display = 'block';  
        } else {  
            scrollUpButton.style.display = 'none';  
        }  
    });  
  
    // Scroll to the top when the button is clicked  
    scrollUpButton.addEventListener('click', () => {  
        chatWindow.scrollTo({  
            top: 0,  
            behavior: 'smooth'  
        });  
    });  
  
    function showLoader() {  
        const loaderElement = document.createElement('div');  
        loaderElement.className = 'loader';  
        loaderElement.id = 'loader';  
  
        for (let i = 0; i < 3; i++) {  
            const dot = document.createElement('div');  
            dot.className = 'dot';  
            loaderElement.appendChild(dot);  
        }  
  
        chatWindow.appendChild(loaderElement);  
        chatWindow.scrollTop = chatWindow.scrollHeight;  
    }  
  
    function hideLoader() {  
        const loaderElement = document.getElementById('loader');  
        if (loaderElement) {  
            loaderElement.remove();  
        }  
    }  
  
    sendButton.addEventListener('click', sendMessage);  
  
    // New event listener for the Enter key  
    userInput.addEventListener('keypress', (event) => {  
        if (event.key === 'Enter') {  
            sendMessage();  
        }  
    });  
  
    function sendMessage() {  
        const message = userInput.value.trim();  
        if (message) {  
            addMessage("user", message);  
            showLoader();  
  
            if (awaitingImageExplanation) {  
                handleImageExplanation(message);  
            } else if (awaitingFollowupResponse && selectedPrompt) {  
                handlePromptFollowup(message);  
            } else if (finalPrompt) {  
                handleDirectPromptModification(message);  
            } else if (dynamicChatActive || dynamicChatQuestionCount < 6) {  
                handleDynamicChat(message);  
            }  
  
            userInput.value = '';  
            hideLoader();  
        }  
    }  
  
    async function handleImageExplanation(message) {  
        const modifiedPrompt = await modifyPromptWithLLM(finalPrompt, message);  
        if (modifiedPrompt && !modifiedPrompt.includes("Failed")) {  
            finalPrompt = modifiedPrompt;  
            addMessage("assistant", `Final Prompt: ${finalPrompt}`, true); // Use HTML  
            awaitingImageExplanation = false;  
            generateAndDisplayImage(finalPrompt);  
        } else {  
            addMessage("assistant", "Failed to modify prompt.");  
        }  
    }  
  
    async function handlePromptFollowup(message) {  
        const modifiedPrompt = await modifyPromptWithLLM(selectedPrompt, message);  
        if (modifiedPrompt && !modifiedPrompt.includes("Failed")) {  
            finalPrompt = modifiedPrompt;  
            addMessage("assistant", `Final Prompt: ${finalPrompt}`, true); // Use HTML  
            awaitingFollowupResponse = false;  
            selectedPrompt = null;  
            generateAndDisplayImage(finalPrompt);  
        } else {  
            addMessage("assistant", "Failed to modify prompt.");  
        }  
    }  
  
    // Function to fetch and display recommendations  
    async function fetchAndDisplayRecommendations(question) {  
        if (showRecommendationsCheckbox.checked) {  
            const context = messages.map(msg => msg.content).join(' ');  
            const recommendations = await generateRecommendation(question, context);  
  
            if (recommendations && !recommendations.includes("Couldn't generate a recommendation")) {  
                const recommendationElement = document.createElement('div');  
                recommendationElement.className = 'assistant-message recommendation';  
                const messageContent = document.createElement('div');  
                messageContent.className = 'message-content';  
                messageContent.textContent = `Recommendations: ${recommendations}`;  
                recommendationElement.appendChild(messageContent);  
                chatWindow.appendChild(recommendationElement);  
                chatWindow.scrollTop = chatWindow.scrollHeight;  
            }  
        }  
    }  
  
    async function handleDynamicChat(message) {  
        const context = messages.map(msg => msg.content).join(' ');  
        const topic = QUESTION_TOPICS[dynamicChatQuestionCount % QUESTION_TOPICS.length];  
        const dynamicQuestion = await generateDynamicQuestions(message, context, topic);  
        addMessage("assistant", dynamicQuestion);  
        dynamicChatQuestionCount++;  
  
        // Fetch and display recommendations for the dynamic question  
        await fetchAndDisplayRecommendations(dynamicQuestion);  
  
        if (dynamicChatQuestionCount === 6) {  
            setTimeout(async () => {  
                finalPrompt = await finalizePrompt(messages);  
                addMessage("assistant", `Final Prompt: ${finalPrompt}`);  
                generateAndDisplayImage(finalPrompt);  
                dynamicChatActive = false;  
                dynamicChatQuestionCount = 0;  
            }, 15000);  
        }  
    }  
  
    function displayRecommendations(recommendations) {  
        recommendationsDiv.innerHTML = `<p>${recommendations}</p>`;  
        recommendationsDiv.style.display = 'block';  
    }  
  
    async function handleDirectPromptModification(message) {  
        const modifiedPrompt = await modifyPromptWithLLM(finalPrompt, message);  
        if (modifiedPrompt && !modifiedPrompt.includes("Failed")) {  
            finalPrompt = modifiedPrompt;  
            addMessage("assistant", `Updated Final Prompt: ${finalPrompt}`, true); // Use HTML  
            generateAndDisplayImage(finalPrompt);  
        } else {  
            addMessage("assistant", "Failed to modify prompt.");  
        }  
    }  
  
    async function generateAndDisplayImage(prompt) {  
        showLoader();  
        const imageUrl = await generateImage(prompt);  
        hideLoader();  
        if (imageUrl && !imageUrl.includes("Failed")) {  
            addMessage("assistant", `Generated Image:`);  
            createImageCard(imageUrl);  
        } else {  
            addMessage("assistant", "Failed to generate image.");  
        }  
    }  
  
    async function callAzureOpenAI(messages, maxTokens, temperature) {  
        try {  
            const response = await fetch(`${azureEndpoint}/openai/deployments/${model}/chat/completions?api-version=${apiVersion}`, {  
                method: 'POST',  
                headers: {  
                    'Content-Type': 'application/json',  
                    'api-key': apiKey  
                },  
                body: JSON.stringify({ messages, temperature, max_tokens: maxTokens })  
            });  
            const data = await response.json();  
            return data.choices[0].message.content.trim();  
        } catch (error) {  
            console.error('Error in API call:', error);  
            return "Error in API call.";  
        }  
    }  
  
    async function modifyPromptWithLLM(initialPrompt, userInstruction) {  
        const prompt = `You are an assistant that modifies image descriptions based on user input.\nInitial Description:\n"${initialPrompt}"\nUser Instruction:\n"${userInstruction}"\nPlease update the initial description by incorporating the user's instruction without changing much...`;  
        return await callAzureOpenAI([  
            { role: "system", content: "You are skilled at updating image descriptions..." },  
            { role: "user", content: prompt }  
        ], 300, 0.7) || "Failed to modify prompt.";  
    }  
  
    async function generateImage(prompt) {  
        const retryCount = 3;  
        const initialDelay = 1000;  
  
        async function fetchImageWithRetry(currentRetry = 0) {  
            try {  
                const response = await fetch(IMAGE_GENERATION_URL, {  
                    method: 'POST',  
                    headers: {  
                        'Content-Type': 'application/json'  
                    },  
                    body: JSON.stringify({ prompt })  
                });  
  
                if (!response.ok) {  
                    throw new Error("Network response was not ok");  
                }  
  
                const data = await response.json();  
  
                if (data.imageUrls) {  
                    return data.imageUrls[0];  
                } else {  
                    throw new Error("No image URL returned");  
                }  
            } catch (error) {  
                console.error("Error generating image:", error);  
                if (currentRetry < retryCount) {  
                    const delay = initialDelay * Math.pow(2, currentRetry);  
                    await new Promise(resolve => setTimeout(resolve, delay));  
                    return fetchImageWithRetry(currentRetry + 1);  
                } else {  
                    return "Failed to generate image.";  
                }  
            }  
        }  
  
        return fetchImageWithRetry();  
    }  
  
    // Function to create an image card in the chat window  
    function createImageCard(imageUrl) {  
        const imageCard = document.createElement('div');  
        imageCard.className = 'image-card';  
  
        const img = document.createElement('img');  
        img.src = imageUrl;  
        img.alt = 'Generated Image';  
        img.onclick = () => openModal(img.src);  
  
        const options = document.createElement('div');  
        options.className = 'image-card-options';  
  
        const zoomButton = document.createElement('button');  
        zoomButton.innerHTML = '<i class="fa fa-search-plus"></i>';  
        zoomButton.onclick = () => openModal(img.src);  
  
        const downloadButton = document.createElement('button');  
        downloadButton.innerHTML = '<i class="fa fa-download"></i>';  
        downloadButton.onclick = () => window.open(imageUrl, '_blank');  
  
        options.appendChild(zoomButton);  
        options.appendChild(downloadButton);  
  
        imageCard.appendChild(img);  
        imageCard.appendChild(options);  
        chatWindow.appendChild(imageCard);  
  
        // Scroll to the bottom of the chat window  
        chatWindow.scrollTop = chatWindow.scrollHeight;  
    }  
  
    // Handle image upload  
    imageUpload.addEventListener('change', (event) => {  
        const file = event.target.files[0];  
        if (file) {  
            const reader = new FileReader();  
            reader.onload = async () => {  
                const base64Image = reader.result.split(',')[1];  
                showLoader();  
                const explanation = await getImageExplanation(base64Image);  
                hideLoader();  
                if (explanation && !explanation.includes("Failed")) {  
                    addMessage("assistant", explanation);  
                    finalPrompt = explanation;  
                    awaitingImageExplanation = true;  
                } else {  
                    addMessage("assistant", "Failed to get image explanation.");  
                }  
            };  
            reader.readAsDataURL(file);  
        }  
    });  
  
    // Function to get image explanation  
    async function getImageExplanation(base64Image) {  
        try {  
            const response = await fetch(`${azureEndpoint}/openai/deployments/${model}/chat/completions?api-version=${apiVersion}`, {  
                method: 'POST',  
                headers: {  
                    'Content-Type': 'application/json',  
                    'api-key': apiKey  
                },  
                body: JSON.stringify({  
                    model,  
                    max_tokens: 2048,  
                    messages: [  
                        {  
                            role: "system",  
                            content: "You are an AI assistant that provides detailed descriptions of images..."  
                        },  
                        {  
                            role: "user",  
                            content: [  
                                { type: "text", text: "Analyze and describe the following image:" },  
                                { type: "image_url", image_url: { url: `data:image/png;base64,${base64Image}` } }  
                            ]  
                        }  
                    ],  
                    temperature: 0.7  
                })  
            });  
            const data = await response.json();  
            const explanation = data.choices[0].message.content;  
            return `Your uploaded image described: \n${explanation}\n\nHow do you want to alter this image prompt of yours?`;  
        } catch (error) {  
            console.error('Error getting image explanation:', error);  
            return "Failed to get image explanation.";  
        }  
    }  
  
    // Fetch existing prompts from the server and render them  
    try {  
        const response = await fetch('http://localhost:3000/api/getPrompts');  
        if (response.ok) {  
            const prompts = await response.json();  
            prompts.forEach(prompt => {  
                renderPromptCategory(prompt.categoryName, prompt.itemNames, prompt.itemDescriptions);  
            });  
        } else {  
            console.error('Failed to fetch prompts');  
        }  
    } catch (error) {  
        console.error('Error fetching prompts:', error);  
    }  
  
    // Function to render a prompt category  
    async function renderPromptCategory(categoryName, itemNames, itemDescriptions) {  
        const iconPreference = window.prompt("Enter Icon Preference:");  
        const iconCode = await icon_code_generation(iconPreference);  
  
        const newCategoryHTML = document.createElement('div');  
        newCategoryHTML.className = 'prompt-category';  
        newCategoryHTML.innerHTML = `  
            <h3 class="category-heading" data-category="${categoryName}">  
                <i class="${iconCode}" title="${categoryName}"></i>  
            </h3>  
            <ul id="${categoryName}" class="prompt-list" style="display:none;">  
                ${itemNames.map((name, index) => `  
                    <li data-prompt-title="${name.trim()}" data-prompt-description="${itemDescriptions[index].trim()}">${name.trim()}</li>  
                `).join('')}  
            </ul>  
        `;  
        document.querySelector('.prompt-library').appendChild(newCategoryHTML);  
        attachEventListeners();  
    }  
  
    // Function to attach event listeners to dynamically created elements  
    function attachEventListeners() {  
        document.querySelectorAll('.category-heading').forEach(heading => {  
            heading.addEventListener('click', () => {  
                toggleCategory(heading.dataset.category);  
            });  
        });  
  
        document.querySelectorAll('.prompt-list li').forEach(item => {  
            item.addEventListener('click', () => {  
                const promptTitle = item.getAttribute('data-prompt-title');  
                const promptDescription = item.getAttribute('data-prompt-description');  
                if (promptTitle && promptDescription) {  
                    selectPrompt(promptDescription);  
                }  
            });  
        });  
    }  
  
    closeModalButton.addEventListener('click', closeModal);  
    window.addEventListener('click', (event) => {  
        if (event.target === modal) {  
            closeModal();  
        }  
    });  
  
    // Add Prompt Button functionality  
    addPromptButton.addEventListener('click', async () => {  
        const categoryName = window.prompt("Enter Category Name (e.g., Animals, Objects, Nature):");  
        if (!categoryName) return;  
  
        const numberOfItems = parseInt(window.prompt("Enter Number of Items to Add:"), 10);  
        if (isNaN(numberOfItems) || numberOfItems <= 0) return;  
  
        let itemNames = [];  
        for (let i = 0; i < numberOfItems; i++) {  
            const itemName = window.prompt(`Enter Name for Item ${i + 1}:`);  
            if (!itemName) return;  
            itemNames.push(itemName);  
        }  
  
        let itemDescriptions = [];  
        for (let i = 0; i < numberOfItems; i++) {  
            const itemDescription = window.prompt(`Enter Description for Item ${i + 1}:`);  
            if (!itemDescription) return;  
            itemDescriptions.push(itemDescription);  
        }  
  
        // Save prompt to the server  
        try {  
            const response = await fetch('https://nopromptgen.azurewebsites.net/api/httpTrigger1?method=savePrompt', {  
                method: 'POST',  
                headers: { 'Content-Type': 'application/json' },  
                body: JSON.stringify({ categoryName, itemNames, itemDescriptions })  
            });  

            if (response.ok) {  
                renderPromptCategory(categoryName, itemNames, itemDescriptions);  
            } else {  
                console.error('Failed to save prompt');  
            }  
        } catch (error) {  
            console.error('Error saving prompt:', error);  
        }  
    });  
  
    // Function to generate an icon code based on user preference  
    async function icon_code_generation(iconPreference) {  
        const prompt = `  
            Suggest a FontAwesome icon class based on the user's preference: "${iconPreference}".  
            The icon should be represented as a free FontAwesome class in the format: "fa-solid fa-icon-name".  
            Here are some examples:  
            - "any kind of car looking icon" should result in "fa-solid fa-car".  
            - "a tree icon" should result in "fa-solid fa-tree".  
            - "an animal icon" should result in "fa-solid fa-dog".  
            Only provide the icon class without any additional text or explanation.  
        `;  
  
        try {  
            const response = await callAzureOpenAI([{ role: "user", content: prompt }], 50, 0.5);  
            console.log('API Response:', response);  
            const suggestedIcon = response?.choices?.[0]?.text?.trim();  
            const validIconFormat = /^fa-solid fa-[\w-]+$/;  
            if (validIconFormat.test(suggestedIcon)) {  
                return suggestedIcon; // Return valid suggestion  
            }  
            const parsedIcon = suggestedIcon.split(/\s+/).find(icon => validIconFormat.test(icon));  
            if (parsedIcon) {  
                return parsedIcon;  
            }  
        } catch (error) {  
            console.error('Error during icon generation:', error);  
        }  
  
        const derivedIcons = {  
            'car': 'fa-solid fa-car',  
            'tree': 'fa-solid fa-tree',  
            'animal': 'fa-solid fa-dog',  
            'user': 'fa-solid fa-user',  
            'camera': 'fa-solid fa-camera',  
            'city': 'fa-solid fa-city',  
            'heart': 'fa-solid fa-heart',  
            'search': 'fa-solid fa-search',  
            'video': 'fa-solid fa-video',  
            'brush': 'fa-solid fa-brush',  
            'utensils': 'fa-solid fa-utensils',  
            'mountain': 'fa-solid fa-mountain',  
            'home': 'fa-solid fa-home',  
            'bell': 'fa-solid fa-bell',  
            'book': 'fa-solid fa-book',  
            'calendar': 'fa-solid fa-calendar',  
            'chart': 'fa-solid fa-chart-bar',  
            'cloud': 'fa-solid fa-cloud',  
            'code': 'fa-solid fa-code',  
            'comment': 'fa-solid fa-comment',  
            'envelope': 'fa-solid fa-envelope',  
            'flag': 'fa-solid fa-flag',  
            'folder': 'fa-solid fa-folder',  
            'gamepad': 'fa-solid fa-gamepad',  
            'gift': 'fa-solid fa-gift',  
            'globe': 'fa-solid fa-globe',  
            'key': 'fa-solid fa-key',  
            'lock': 'fa-solid fa-lock',  
            'music': 'fa-solid fa-music',  
            'phone': 'fa-solid fa-phone',  
            'shopping-cart': 'fa-solid fa-shopping-cart',  
            'star': 'fa-solid fa-star',  
            'sun': 'fa-solid fa-sun',  
            'thumbs-up': 'fa-solid fa-thumbs-up',  
            'toolbox': 'fa-solid fa-toolbox',  
            'trash': 'fa-solid fa-trash',  
            'user-circle': 'fa-solid fa-user-circle',  
            'wrench': 'fa-solid fa-wrench',  
            'wifi': 'fa-solid fa-wifi',  
            'battery-full': 'fa-solid fa-battery-full',  
            'bolt': 'fa-solid fa-bolt',  
            'coffee': 'fa-solid fa-coffee',  
            'handshake': 'fa-solid fa-handshake',  
            'laptop': 'fa-solid fa-laptop',  
            'microphone': 'fa-solid fa-microphone',  
            'paper-plane': 'fa-solid fa-paper-plane',  
            'plane': 'fa-solid fa-plane',  
            'robot': 'fa-solid fa-robot',  
            'school': 'fa-solid fa-school',  
            'tools': 'fa-solid fa-tools',  
            'rocket': 'fa-solid fa-rocket',  
            'snowflake': 'fa-solid fa-snowflake',  
            'umbrella': 'fa-solid fa-umbrella',  
            'wallet': 'fa-solid fa-wallet',  
            'anchor': 'fa-solid fa-anchor',  
            'archway': 'fa-solid fa-archway',  
            'bicycle': 'fa-solid fa-bicycle',  
            'binoculars': 'fa-solid fa-binoculars',  
            'crown': 'fa-solid fa-crown',  
            'diamond': 'fa-solid fa-gem',  
            'drum': 'fa-solid fa-drum',  
            'feather': 'fa-solid fa-feather',  
            'fish': 'fa-solid fa-fish',  
            'frog': 'fa-solid fa-frog',  
            'gavel': 'fa-solid fa-gavel',  
            'hammer': 'fa-solid fa-hammer',  
            'hospital': 'fa-solid fa-hospital',  
            'lightbulb': 'fa-solid fa-lightbulb',  
            'magnet': 'fa-solid fa-magnet',  
            'map': 'fa-solid fa-map',  
            'medal': 'fa-solid fa-medal',  
            'palette': 'fa-solid fa-palette',  
            'pepper-hot': 'fa-solid fa-pepper-hot',  
            'piggy-bank': 'fa-solid fa-piggy-bank',  
            'ring': 'fa-solid fa-ring',  
            'ship': 'fa-solid fa-ship',  
            'skull': 'fa-solid fa-skull',  
            'smile': 'fa-solid fa-smile',  
            'space-shuttle': 'fa-solid fa-space-shuttle',  
            'spider': 'fa-solid fa-spider',  
            'stopwatch': 'fa-solid fa-stopwatch',  
            'trophy': 'fa-solid fa-trophy',  
            'truck': 'fa-solid fa-truck',  
            'volleyball': 'fa-solid fa-volleyball-ball',  
            'wine-glass': 'fa-solid fa-wine-glass',  
            'yacht': 'fa-solid fa-sailboat',  
            'leaf': 'fa-solid fa-leaf',  
            'apple': 'fa-solid fa-apple-alt',  
            'rocket-launch': 'fa-solid fa-rocket-launch',  
            'paint-roller': 'fa-solid fa-paint-roller',  
            'fire': 'fa-solid fa-fire',  
            'shield': 'fa-solid fa-shield-alt',  
            'tag': 'fa-solid fa-tag',  
            'thermometer': 'fa-solid fa-thermometer',  
            'puzzle-piece': 'fa-solid fa-puzzle-piece',  
            'battery-half': 'fa-solid fa-battery-half',  
            'balance-scale': 'fa-solid fa-balance-scale',  
            'hourglass': 'fa-solid fa-hourglass',  
            'clipboard': 'fa-solid fa-clipboard',  
            'dumbbell': 'fa-solid fa-dumbbell',  
            'futbol': 'fa-solid fa-futbol',  
            'hospital-alt': 'fa-solid fa-hospital-alt',  
            'magic': 'fa-solid fa-magic',  
            'praying-hands': 'fa-solid fa-praying-hands',  
            'recycle': 'fa-solid fa-recycle',  
            'stethoscope': 'fa-solid fa-stethoscope',  
            'syringe': 'fa-solid fa-syringe',  
            'walking': 'fa-solid fa-walking',  
            'weight': 'fa-solid fa-weight',  
            'yin-yang': 'fa-solid fa-yin-yang',  
        };        
  
        for (const [key, value] of Object.entries(derivedIcons)) {  
            if (iconPreference.toLowerCase().includes(key)) {  
                return value;  
            }  
        }  
  
        return "fa-solid fa-info-circle"; // Default icon if no match  
    }  
});  