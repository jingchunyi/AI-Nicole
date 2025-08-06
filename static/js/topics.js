// 生成唯一的会话ID
function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// 全局变量
let topics = [];
let currentTopicId = null;
let currentRole = 'operation_expert';
let currentController = null; // 用于控制请求中断
let selectedFiles = []; // 存储选中的文件
const sessionId = generateSessionId();

// 角色映射
let roleMap = {
    'operation_expert': { name: '运营官', icon: '👨‍💼', description: '数据驱动×创意破壁双引擎运营官', prompt: '' },
    'product_manager': { name: '产品经理', icon: '📱', description: '专注产品规划和用户体验', prompt: '' },
    'marketing_manager': { name: '市场营销经理', icon: '📈', description: '精通市场策略和品牌推广', prompt: '' },
    'data_analyst': { name: '数据分析师', icon: '📊', description: '擅长数据分析和洞察', prompt: '' },
    'content_strategist': { name: '内容策划', icon: '✍️', description: '专注内容创作和传播策略', prompt: '' }
};

// 从URL获取角色参数
function getRoleFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('role') || 'operation_expert';
}

// 加载角色信息
async function loadRoleInfo() {
    try {
        const response = await fetch('/api/roles');
        if (response.ok) {
            const roles = await response.json();
            // 完全替换roleMap，支持动态助手
            roleMap = roles;
        }
    } catch (error) {
        console.error('加载角色信息失败:', error);
    }
}

// 更新角色显示
function updateRoleDisplay(role) {
    const roleInfo = roleMap[role];
    if (roleInfo) {
        // 处理头像显示
        const roleIconElement = document.getElementById('role-icon');
        if (roleInfo.avatar_type === 'image') {
            roleIconElement.innerHTML = `<img src="${roleInfo.icon}" alt="${roleInfo.name}" class="w-8 h-8 object-cover rounded-full">`;
        } else {
            roleIconElement.textContent = roleInfo.icon;
        }
        
        document.getElementById('role-name').textContent = roleInfo.name;
        document.getElementById('role-description').textContent = roleInfo.description;
        
        // 更新角色prompt显示
        const promptDisplay = document.getElementById('role-prompt-display');
        if (promptDisplay) {
            promptDisplay.innerHTML = formatPromptForDisplay(roleInfo.prompt || '暂无角色设定');
        }
    }
}

// 格式化prompt显示
function formatPromptForDisplay(prompt) {
    if (!prompt || prompt === '暂无角色设定') {
        return '<div class="text-gray-400 italic">暂无角色设定</div>';
    }
    
    // 简单的格式化：保留换行，限制显示长度
    let formatted = prompt.replace(/\n/g, '<br>');
    if (formatted.length > 500) {
        formatted = formatted.substring(0, 500) + '...<br><br><span class="text-green-600 text-xs">点击编辑查看完整内容</span>';
    }
    return formatted;
}

// 切换角色信息面板
function toggleRoleInfo() {
    const panel = document.getElementById('role-info-panel');
    const icon = document.getElementById('toggle-icon');
    
    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        icon.style.transform = 'rotate(180deg)';
    } else {
        panel.classList.add('hidden');
        icon.style.transform = 'rotate(0deg)';
    }
}

// 显示编辑prompt模态框
function showEditPromptModal() {
    const roleInfo = roleMap[currentRole];
    
    document.getElementById('edit-role-name').value = roleInfo.name;
    document.getElementById('edit-role-desc').value = roleInfo.description;
    document.getElementById('edit-role-prompt').value = roleInfo.prompt || '';
    
    document.getElementById('edit-prompt-modal').classList.remove('hidden');
}

// 隐藏编辑prompt模态框
function hideEditPromptModal() {
    document.getElementById('edit-prompt-modal').classList.add('hidden');
}

// 保存角色prompt
async function saveRolePrompt() {
    const description = document.getElementById('edit-role-desc').value.trim();
    const prompt = document.getElementById('edit-role-prompt').value.trim();
    
    if (!prompt) {
        alert('请输入角色prompt');
        return;
    }
    
    try {
        const response = await fetch('/api/roles', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                role: currentRole,
                description: description,
                prompt: prompt
            })
        });
        
        if (response.ok) {
            // 更新本地数据
            roleMap[currentRole].description = description;
            roleMap[currentRole].prompt = prompt;
            
            // 更新显示
            updateRoleDisplay(currentRole);
            hideEditPromptModal();
            
            alert('角色设定已保存');
        } else {
            alert('保存失败，请重试');
        }
    } catch (error) {
        console.error('保存角色设定失败:', error);
        alert('保存失败，请重试');
    }
}

// 重置为默认prompt
async function resetToDefaultPrompt() {
    if (!confirm('确定要重置为默认设定吗？这将覆盖您的自定义内容。')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/roles/${currentRole}/reset`, {
            method: 'POST'
        });
        
        if (response.ok) {
            const roleInfo = await response.json();
            roleMap[currentRole] = { ...roleMap[currentRole], ...roleInfo };
            
            // 更新模态框内容
            document.getElementById('edit-role-desc').value = roleInfo.description;
            document.getElementById('edit-role-prompt').value = roleInfo.prompt;
            
            alert('已重置为默认设定');
        } else {
            alert('重置失败，请重试');
        }
    } catch (error) {
        console.error('重置失败:', error);
        alert('重置失败，请重试');
    }
}

// 格式化AI响应文本
function formatAIResponse(text) {
    // 处理标题（# ## ### 等）
    text = text.replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-4 mb-2 text-gray-800">$1</h3>');
    text = text.replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold mt-5 mb-3 text-gray-800">$1</h2>');
    text = text.replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-6 mb-4 text-gray-800">$1</h1>');
    
    // 处理粗体文本
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>');
    
    // 处理斜体文本
    text = text.replace(/\*(.*?)\*/g, '<em class="italic text-gray-700">$1</em>');
    
    // 处理列表项
    text = text.replace(/^[\d]+\.\s+(.*$)/gm, '<div class="flex items-start mb-2"><span class="inline-block w-6 h-6 bg-green-100 text-green-800 rounded-full text-sm text-center mr-3 mt-0.5 font-medium">$&</span><span class="flex-1">$1</span></div>');
    text = text.replace(/^-\s+(.*$)/gm, '<div class="flex items-start mb-2"><span class="inline-block w-2 h-2 bg-green-500 rounded-full mr-3 mt-2"></span><span class="flex-1">$1</span></div>');
    
    // 处理换行
    text = text.replace(/\n\n/g, '</p><p class="mb-3">');
    text = text.replace(/\n/g, '<br>');
    
    // 包装在段落中
    if (!text.includes('<h1>') && !text.includes('<h2>') && !text.includes('<h3>') && !text.includes('<div class="flex')) {
        text = '<p class="mb-3">' + text + '</p>';
    }
    
    return text;
}

// 创建思考动画
function createThinkingAnimation() {
    const thinkingDiv = document.createElement('div');
    thinkingDiv.className = 'thinking-animation flex items-center space-x-1 text-gray-500 mb-4';
    thinkingDiv.innerHTML = `
        <div class="flex items-center space-x-1">
            <span class="text-sm">AI正在思考</span>
            <div class="flex space-x-1">
                <div class="w-2 h-2 bg-green-500 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
                <div class="w-2 h-2 bg-green-500 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
                <div class="w-2 h-2 bg-green-500 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
            </div>
        </div>
    `;
    return thinkingDiv;
}

// 加载话题列表
async function loadTopics() {
    try {
        const response = await fetch(`/api/topics?role=${currentRole}`);
        topics = await response.json();
        renderTopics();
    } catch (error) {
        console.error('加载话题失败:', error);
    }
}

// 渲染话题列表
function renderTopics() {
    const topicsList = document.getElementById('topics-list');
    topicsList.innerHTML = '';

    const filteredTopics = topics.filter(topic => topic.role === currentRole);

    filteredTopics.forEach(topic => {
        const topicDiv = document.createElement('div');
        topicDiv.className = `p-3 rounded-lg hover:bg-gray-100 border-l-4 border-transparent hover:border-green-500 ${currentTopicId === topic.id ? 'bg-gray-100 border-green-500' : ''}`;
        
        // 创建内容容器
        const contentContainer = document.createElement('div');
        contentContainer.className = 'flex items-start justify-between group';
        
        // 创建话题内容区域
        const topicContent = document.createElement('div');
        topicContent.className = 'flex-1 cursor-pointer';
        topicContent.innerHTML = `
            <div class="font-medium text-gray-900">${topic.title}</div>
            <div class="text-sm text-gray-500 mt-1">${topic.description || '无描述'}</div>
            <div class="text-xs text-gray-400 mt-1">${new Date(topic.updated_at).toLocaleDateString()}</div>
        `;
        
        // 添加点击事件
        topicContent.addEventListener('click', () => selectTopic(topic.id));
        
        // 创建编辑按钮
        const editButton = document.createElement('button');
        editButton.className = 'opacity-0 group-hover:opacity-100 ml-2 p-1 text-gray-400 hover:text-gray-600 rounded';
        editButton.title = '编辑话题';
        editButton.innerHTML = `
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
            </svg>
        `;
        
        // 添加编辑按钮点击事件
        editButton.addEventListener('click', (event) => {
            event.stopPropagation();
            editTopicTitle(topic.id);
        });
        
        // 组装元素
        contentContainer.appendChild(topicContent);
        contentContainer.appendChild(editButton);
        topicDiv.appendChild(contentContainer);
        
        topicsList.appendChild(topicDiv);
    });

    if (filteredTopics.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'text-center text-gray-500 py-8';
        emptyDiv.innerHTML = `
            <p>还没有话题</p>
            <p class="text-sm mt-1">点击"新建话题"开始对话</p>
        `;
        topicsList.appendChild(emptyDiv);
    }
}

// 选择话题
async function selectTopic(topicId) {
    currentTopicId = topicId;
    const topic = topics.find(t => t.id === topicId);
    
    if (topic) {
        // 更新话题标题栏
        document.getElementById('topic-title').textContent = topic.title;
        document.getElementById('topic-description').textContent = topic.description || '';
        document.getElementById('topic-header').classList.remove('hidden');
        document.getElementById('input-area').classList.remove('hidden');
        
        // 清空聊天记录
        const chatMessages = document.getElementById('chat-messages');
        chatMessages.innerHTML = '';
        
        // 加载话题的对话历史
        await loadTopicConversations(topicId);
        
        // 重新渲染话题列表以更新选中状态
        renderTopics();
    }
}

// 加载话题对话历史
async function loadTopicConversations(topicId) {
    try {
        const response = await fetch(`/api/topics/${topicId}`);
        if (response.ok) {
            const data = await response.json();
            data.conversations.forEach(conv => {
                addMessage(conv.role, conv.content, false);
            });
        }
    } catch (error) {
        console.error('加载对话历史失败:', error);
    }
}

// 添加消息到界面
function addMessage(role, content, isStreaming = false) {
    const chatMessages = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `flex ${role === 'user' ? 'justify-end' : 'justify-start'} mb-6`;
    
    const messageContent = document.createElement('div');
    messageContent.className = `max-w-4xl p-4 rounded-lg ${role === 'user' ? 'bg-green-600 text-white' : 'bg-white shadow-md border'}`;
    
    if (role === 'user') {
        messageContent.textContent = content;
    } else {
        if (isStreaming) {
            messageContent.innerHTML = formatAIResponse(content);
        } else {
            messageContent.innerHTML = formatAIResponse(content);
        }
    }
    
    messageDiv.appendChild(messageContent);
    chatMessages.appendChild(messageDiv);
    
    // 滚动到底部
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return messageContent;
}

// 停止AI响应
function stopAIResponse() {
    if (currentController) {
        currentController.abort();
        currentController = null;
        
        // 移除思考动画
        const thinkingAnimation = document.querySelector('.thinking-animation');
        if (thinkingAnimation) {
            thinkingAnimation.remove();
        }
        
        // 保存当前AI的部分回答到数据库
        if (window.currentAIResponse && window.currentAIResponse.trim()) {
            savePartialAIResponse(window.currentAIResponse);
        }
        
        // 重新启用输入
        const messageInput = document.getElementById('message-input');
        const sendButton = document.getElementById('send-button');
        const stopButton = document.getElementById('stop-button');
        
        messageInput.disabled = false;
        sendButton.disabled = false;
        stopButton.classList.add('hidden');
        messageInput.focus();
    }
}

// 保存部分AI回答
async function savePartialAIResponse(content) {
    if (!currentTopicId) return;
    
    try {
        await fetch('/api/save-partial-response', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                topic_id: currentTopicId,
                session_id: sessionId,
                content: content + '\n\n[回答已停止]'
            })
        });
    } catch (error) {
        console.error('保存部分回答失败:', error);
    }
}

// 保存完整AI回答
async function saveCompleteAIResponse(content) {
    if (!currentTopicId) return;
    
    try {
        await fetch('/api/save-complete-response', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                topic_id: currentTopicId,
                session_id: sessionId,
                content: content
            })
        });
    } catch (error) {
        console.error('保存完整回答失败:', error);
    }
}

// 文件上传相关函数
function openFileDialog() {
    document.getElementById('file-input').click();
}

function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    // 添加到已选文件列表
    selectedFiles.push(...files);
    
    // 更新文件预览
    updateFilePreview();
    
    // 清空input以允许重复选择同一文件
    event.target.value = '';
}

function updateFilePreview() {
    const filePreview = document.getElementById('file-preview');
    const fileList = document.getElementById('file-list');
    
    if (selectedFiles.length === 0) {
        filePreview.classList.add('hidden');
        return;
    }
    
    filePreview.classList.remove('hidden');
    fileList.innerHTML = '';
    
    selectedFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'flex items-center justify-between p-2 bg-white rounded border';
        
        const fileInfo = document.createElement('div');
        fileInfo.className = 'flex items-center';
        
        const fileIcon = getFileIcon(file.type, file.name);
        const fileName = file.name.length > 30 ? file.name.substring(0, 30) + '...' : file.name;
        const fileSize = formatFileSize(file.size);
        
        fileInfo.innerHTML = `
            <span class="text-2xl mr-3">${fileIcon}</span>
            <div>
                <div class="text-sm font-medium text-gray-900">${fileName}</div>
                <div class="text-xs text-gray-500">${fileSize}</div>
            </div>
        `;
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'text-red-500 hover:text-red-700 p-1';
        removeBtn.innerHTML = `
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
        `;
        removeBtn.onclick = () => removeFile(index);
        
        fileItem.appendChild(fileInfo);
        fileItem.appendChild(removeBtn);
        fileList.appendChild(fileItem);
    });
}

function getFileIcon(fileType, fileName) {
    const extension = fileName.split('.').pop().toLowerCase();
    
    if (fileType.startsWith('image/')) return '🖼️';
    if (fileType.includes('pdf') || extension === 'pdf') return '📄';
    if (fileType.includes('word') || ['doc', 'docx'].includes(extension)) return '📝';
    if (fileType.includes('text') || extension === 'txt') return '📄';
    if (fileType.includes('excel') || ['xls', 'xlsx'].includes(extension)) return '📊';
    if (fileType.includes('powerpoint') || ['ppt', 'pptx'].includes(extension)) return '📊';
    
    return '📎';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    updateFilePreview();
}

function clearAllFiles() {
    selectedFiles = [];
    updateFilePreview();
}

// 上传文件到服务器
async function uploadFiles(files) {
    if (files.length === 0) return [];
    
    const formData = new FormData();
    files.forEach((file, index) => {
        formData.append(`file_${index}`, file);
    });
    formData.append('topic_id', currentTopicId);
    formData.append('session_id', sessionId);
    
    try {
        const response = await fetch('/api/upload-files', {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            const result = await response.json();
            return result.file_urls || [];
        } else {
            throw new Error('文件上传失败');
        }
    } catch (error) {
        console.error('文件上传失败:', error);
        alert('文件上传失败，请重试');
        return [];
    }
}

// 编辑话题标题相关函数
let editingTopicId = null;

function editTopicTitle(topicId) {
    const topic = topics.find(t => t.id === topicId);
    if (!topic) return;
    
    editingTopicId = topicId;
    
    // 填入当前值
    document.getElementById('edit-title-input').value = topic.title;
    document.getElementById('edit-description-input').value = topic.description || '';
    
    // 显示模态框
    document.getElementById('edit-topic-title-modal').classList.remove('hidden');
    
    // 聚焦到标题输入框
    setTimeout(() => {
        document.getElementById('edit-title-input').focus();
        document.getElementById('edit-title-input').select();
    }, 100);
}

function showEditTopicTitleModal() {
    if (!currentTopicId) return;
    editTopicTitle(currentTopicId);
}

function hideEditTopicTitleModal() {
    document.getElementById('edit-topic-title-modal').classList.add('hidden');
    editingTopicId = null;
}

async function saveTopicTitle() {
    if (!editingTopicId) return;
    
    const title = document.getElementById('edit-title-input').value.trim();
    const description = document.getElementById('edit-description-input').value.trim();
    
    if (!title) {
        alert('话题标题不能为空');
        return;
    }
    
    try {
        const response = await fetch(`/api/topics/${editingTopicId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: title,
                description: description
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            
            // 更新本地topics数组
            const topicIndex = topics.findIndex(t => t.id === editingTopicId);
            if (topicIndex !== -1) {
                topics[topicIndex] = result.topic;
            }
            
            // 重新渲染话题列表
            renderTopics();
            
            // 如果正在编辑当前话题，更新标题栏
            if (currentTopicId === editingTopicId) {
                document.getElementById('topic-title').textContent = title;
                document.getElementById('topic-description').textContent = description || '';
            }
            
            // 隐藏模态框
            hideEditTopicTitleModal();
            
            alert('话题更新成功');
        } else {
            const error = await response.json();
            alert(error.error || '更新失败');
        }
    } catch (error) {
        console.error('更新话题失败:', error);
        alert('更新话题失败，请重试');
    }
}

// 发送消息
async function sendMessage() {
    if (!currentTopicId) {
        alert('请先选择一个话题');
        return;
    }

    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const stopButton = document.getElementById('stop-button');
    const message = messageInput.value.trim();
    
    if (!message && selectedFiles.length === 0) {
        alert('请输入消息或选择文件');
        return;
    }

    // 禁用输入和发送按钮，显示停止按钮
    messageInput.disabled = true;
    sendButton.disabled = true;
    stopButton.classList.remove('hidden');

    // 先上传文件（如果有的话）
    let fileUrls = [];
    if (selectedFiles.length > 0) {
        try {
            fileUrls = await uploadFiles(selectedFiles);
        } catch (error) {
            console.error('文件上传失败:', error);
            // 重新启用按钮
            messageInput.disabled = false;
            sendButton.disabled = false;
            stopButton.classList.add('hidden');
            return;
        }
    }

    // 构建完整的消息内容（包含文件信息）
    let fullMessage = message;
    if (fileUrls.length > 0) {
        const fileInfo = fileUrls.map(url => `[文件: ${url.split('/').pop()}]`).join('\n');
        fullMessage = message ? `${message}\n\n${fileInfo}` : fileInfo;
    }

    // 添加用户消息到界面
    addMessage('user', fullMessage);

    // 添加思考动画
    const chatMessages = document.getElementById('chat-messages');
    const thinkingAnimation = createThinkingAnimation();
    chatMessages.appendChild(thinkingAnimation);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // 创建AbortController用于取消请求
    currentController = new AbortController();

    // 创建AI响应的消息容器
    let aiMessageContent = null;
    let aiResponse = '';
    window.currentAIResponse = ''; // 全局变量用于停止时保存

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                role: currentRole,
                session_id: sessionId,
                topic_id: currentTopicId
            }),
            signal: currentController.signal
        });

        // 移除思考动画
        thinkingAnimation.remove();
        
        // 创建AI消息容器
        aiMessageContent = addMessage('assistant', '', true);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const {value, done} = await reader.read();
            if (done) break;
            
            const text = decoder.decode(value);
            const lines = text.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const jsonStr = line.slice(6);
                    if (jsonStr === '[DONE]') {
                        // 完整回答完成，保存到数据库
                        if (aiResponse.trim()) {
                            await saveCompleteAIResponse(aiResponse);
                        }
                        break;
                    }
                    try {
                        const data = JSON.parse(jsonStr);
                        if (data.choices && data.choices[0] && data.choices[0].delta) {
                            const content = data.choices[0].delta.content;
                            if (content) {
                                aiResponse += content;
                                window.currentAIResponse = aiResponse; // 更新全局变量
                                aiMessageContent.innerHTML = formatAIResponse(aiResponse);
                            }
                        }
                    } catch (e) {
                        // 忽略解析错误
                    }
                }
            }
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    } catch (error) {
        // 移除思考动画
        if (thinkingAnimation.parentNode) {
            thinkingAnimation.remove();
        }
        
        if (error.name === 'AbortError') {
            console.log('请求被用户取消');
            // 用户主动停止，内容已经在stopAIResponse中保存了
            if (aiMessageContent && window.currentAIResponse && window.currentAIResponse.trim()) {
                aiMessageContent.innerHTML = formatAIResponse(window.currentAIResponse + '\n\n[回答已停止]');
            } else if (aiMessageContent) {
                aiMessageContent.innerHTML = '<p class="text-gray-500 italic">回答已停止</p>';
            }
        } else {
            console.error('Error:', error);
            if (!aiMessageContent) {
                aiMessageContent = addMessage('assistant', '', true);
            }
            aiMessageContent.innerHTML = '<p class="text-red-500">发送消息失败，请重试</p>';
        }
    } finally {
        // 清理全局变量和文件
        window.currentAIResponse = '';
        selectedFiles = [];
        updateFilePreview();
        
        // 重新启用输入和发送按钮，隐藏停止按钮
        currentController = null;
        messageInput.disabled = false;
        sendButton.disabled = false;
        stopButton.classList.add('hidden');
        messageInput.value = '';
        messageInput.focus();
    }
}

// 显示新建话题模态框
function showNewTopicModal() {
    document.getElementById('new-topic-modal').classList.remove('hidden');
}

// 隐藏新建话题模态框
function hideNewTopicModal() {
    document.getElementById('new-topic-modal').classList.add('hidden');
    document.getElementById('topic-title-input').value = '';
    document.getElementById('topic-description-input').value = '';
}

// 创建新话题
async function createTopic() {
    const title = document.getElementById('topic-title-input').value.trim();
    const description = document.getElementById('topic-description-input').value.trim();

    if (!title) {
        alert('请输入话题标题');
        return;
    }

    try {
        const response = await fetch('/api/topics', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: title,
                description: description,
                role: currentRole
            })
        });

        if (response.ok) {
            const newTopic = await response.json();
            hideNewTopicModal();
            await loadTopics();
            // 自动选择新创建的话题
            selectTopic(newTopic.id);
        } else {
            alert('创建话题失败');
        }
    } catch (error) {
        console.error('创建话题失败:', error);
        alert('创建话题失败');
    }
}

// 初始化页面
document.addEventListener('DOMContentLoaded', function() {
    // 获取当前角色
    currentRole = getRoleFromUrl();
    
    // 加载角色信息和话题列表
    loadRoleInfo().then(() => {
        updateRoleDisplay(currentRole);
    });
    loadTopics();

    // 事件监听
    document.getElementById('new-topic-btn').addEventListener('click', showNewTopicModal);
    document.getElementById('cancel-topic-btn').addEventListener('click', hideNewTopicModal);
    document.getElementById('create-topic-btn').addEventListener('click', createTopic);
    
    // 角色信息相关事件
    document.getElementById('toggle-role-info').addEventListener('click', toggleRoleInfo);
    document.getElementById('edit-prompt-btn').addEventListener('click', showEditPromptModal);
    document.getElementById('close-prompt-modal').addEventListener('click', hideEditPromptModal);
    document.getElementById('cancel-prompt-edit').addEventListener('click', hideEditPromptModal);
    document.getElementById('save-prompt-btn').addEventListener('click', saveRolePrompt);
    document.getElementById('reset-prompt-btn').addEventListener('click', resetToDefaultPrompt);
    
    // 发送消息事件
    const sendButton = document.getElementById('send-button');
    const stopButton = document.getElementById('stop-button');
    const messageInput = document.getElementById('message-input');
    
    sendButton.addEventListener('click', sendMessage);
    stopButton.addEventListener('click', stopAIResponse);
    
    // 文件上传相关事件
    document.getElementById('attach-file-btn').addEventListener('click', openFileDialog);
    document.getElementById('file-input').addEventListener('change', handleFileSelect);
    document.getElementById('clear-files').addEventListener('click', clearAllFiles);
    
    // 编辑话题标题相关事件
    document.getElementById('edit-topic-title-btn').addEventListener('click', showEditTopicTitleModal);
    document.getElementById('close-edit-title-modal').addEventListener('click', hideEditTopicTitleModal);
    document.getElementById('cancel-edit-title').addEventListener('click', hideEditTopicTitleModal);
    document.getElementById('save-title-btn').addEventListener('click', saveTopicTitle);
    
    // 编辑标题模态框键盘事件
    document.getElementById('edit-title-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            saveTopicTitle();
        }
    });
    
    document.getElementById('edit-topic-title-modal').addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            hideEditTopicTitleModal();
        }
    });
    
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // 点击模态框外部关闭
    document.getElementById('new-topic-modal').addEventListener('click', function(e) {
        if (e.target === this) {
            hideNewTopicModal();
        }
    });
});