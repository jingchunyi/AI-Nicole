document.addEventListener('DOMContentLoaded', () => {
    const newGroupBtn = document.getElementById('new-group-btn');
    const newGroupModal = document.getElementById('new-group-modal');
    const cancelGroupBtn = document.getElementById('cancel-group-btn');
    const createGroupBtn = document.getElementById('create-group-btn');
    const groupsList = document.getElementById('groups-list');
    const assistantCheckboxList = document.getElementById('assistant-checkbox-list');
    
    // 聊天界面元素
    const welcomeScreen = document.getElementById('welcome-screen');
    const groupHeader = document.getElementById('group-header');
    const groupTitle = document.getElementById('group-title');
    const groupDescription = document.getElementById('group-description');
    const groupAvatarStack = document.getElementById('group-avatar-stack');
    const chatMessages = document.getElementById('chat-messages');
    const inputArea = document.getElementById('input-area');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const stopButton = document.getElementById('stop-button');

    let currentGroup = null;
    let currentTopic = null;
    let currentController = null; // 用于取消请求
    let sessionId = `session_${new Date().getTime()}`;
    let editingGroup = null; // 当前正在编辑的群组

    async function loadAssistants() {
        try {
            const response = await fetch('/api/assistants');
            if (!response.ok) {
                throw new Error('Failed to load assistants');
            }
            const data = await response.json();
            assistantCheckboxList.innerHTML = '';
            data.assistants.forEach(assistant => {
                const div = document.createElement('div');
                div.className = 'flex items-center';
                div.innerHTML = `
                    <input type="checkbox" id="assistant-${assistant.id}" name="assistants" value="${assistant.id}" class="h-4 w-4 text-green-600 border-gray-300 rounded focus:ring-green-500">
                    <label for="assistant-${assistant.id}" class="ml-3 text-sm text-gray-700">${assistant.name}</label>
                `;
                assistantCheckboxList.appendChild(div);
            });
        } catch (error) {
            console.error(error);
            assistantCheckboxList.innerHTML = '<p class="text-red-500">无法加载助手列表</p>';
        }
    }

    async function loadGroups() {
        try {
            const response = await fetch('/api/groups');
             if (!response.ok) {
                throw new Error('Failed to load groups');
            }
            const data = await response.json();
            groupsList.innerHTML = '';
            if (data.groups.length === 0) {
                groupsList.innerHTML = '<p class="text-center text-gray-500 text-sm mt-4">还没有群组，快来创建一个吧！</p>';
                return;
            }

            data.groups.forEach(group => {
                const groupElement = document.createElement('div');
                groupElement.className = 'p-3 rounded-lg hover:bg-gray-100 cursor-pointer border border-transparent';
                groupElement.dataset.groupId = group.id;
                groupElement.innerHTML = `
                    <div class="font-semibold text-gray-800">${group.name}</div>
                    <div class="text-sm text-gray-500 truncate">${group.description || '暂无描述'}</div>
                `;
                groupElement.addEventListener('click', () => {
                    selectGroup(group);
                    document.querySelectorAll('#groups-list > div').forEach(el => {
                        el.classList.remove('bg-green-50', 'border-green-200');
                    });
                    groupElement.classList.add('bg-green-50', 'border-green-200');
                });
                groupsList.appendChild(groupElement);
            });

        } catch (error) {
            console.error(error);
            groupsList.innerHTML = '<p class="text-red-500">无法加载群组列表</p>';
        }
    }

    async function selectGroup(group) {
        currentGroup = group;
        updateGroupHeader(group);
        showChatArea();
        
        try {
            // 获取或创建群组对应的话题
            const response = await fetch(`/api/groups/${group.id}/topic`);
            if (!response.ok) {
                throw new Error('Failed to get group topic');
            }
            const topic = await response.json();
            currentTopic = topic;
            
            // 加载对话历史
            await loadConversationHistory(topic.id);
            
        } catch (error) {
            console.error(error);
            chatMessages.innerHTML = '<p class="text-red-500 text-center">无法加载群组对话</p>';
        }
    }

    function updateGroupHeader(group) {
        groupTitle.textContent = group.name;
        groupDescription.textContent = group.description || '群组对话';
        
        // 显示群组成员头像
        groupAvatarStack.innerHTML = group.assistants.map(assistant => {
            if (assistant.avatar_type === 'emoji') {
                return `<div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center ring-2 ring-white text-sm">${assistant.avatar}</div>`;
            } else {
                return `<div class="w-8 h-8 rounded-full ring-2 ring-white overflow-hidden"><img src="${assistant.avatar}" alt="${assistant.name}" class="w-full h-full object-cover"></div>`;
            }
        }).join('');
    }

    function showWelcomeScreen() {
        welcomeScreen.classList.remove('hidden');
        groupHeader.classList.add('hidden');
        inputArea.classList.add('hidden');
        chatMessages.innerHTML = '';
        chatMessages.appendChild(welcomeScreen);
    }

    function showChatArea() {
        welcomeScreen.classList.add('hidden');
        groupHeader.classList.remove('hidden');
        inputArea.classList.remove('hidden');
        chatMessages.innerHTML = '';
    }

    async function loadConversationHistory(topicId) {
        try {
            const response = await fetch(`/api/topics/${topicId}`);
            if (!response.ok) {
                throw new Error('Failed to load conversation history');
            }
            const data = await response.json();
            
            chatMessages.innerHTML = '';
            data.conversations.forEach(conversation => {
                renderMessage(conversation);
            });
            chatMessages.scrollTop = chatMessages.scrollHeight;
            
        } catch (error) {
            console.error(error);
            chatMessages.innerHTML = '<p class="text-red-500 text-center">无法加载对话历史</p>';
        }
    }

    function renderMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.className = 'mb-4';
        
        const isUser = message.role === 'user';
        const avatar = isUser ? '👤' : '🤖';
        const name = isUser ? '用户' : '助手';
        
        messageElement.innerHTML = `
            <div class="flex items-start ${isUser ? 'justify-end' : ''}">
                ${!isUser ? `<div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center mr-3 flex-shrink-0">${avatar}</div>` : ''}
                <div class="flex flex-col ${isUser ? 'items-end' : 'items-start'}">
                    <div class="font-medium text-sm text-gray-600 mb-1">${name}</div>
                    <div class="max-w-md p-3 rounded-lg ${isUser ? 'bg-green-600 text-white' : 'bg-white shadow-sm'}">
                        ${message.content.replace(/\n/g, '<br>')}
                    </div>
                </div>
                ${isUser ? `<div class="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center ml-3 flex-shrink-0">${avatar}</div>` : ''}
            </div>
        `;
        
        chatMessages.appendChild(messageElement);
        return messageElement;
    }

    async function sendMessage() {
        const message = messageInput.value.trim();
        if (!message || !currentTopic) return;

        // 显示用户消息
        const userMessage = {
            role: 'user',
            content: message
        };
        renderMessage(userMessage);
        messageInput.value = '';
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // 禁用输入
        messageInput.disabled = true;
        sendButton.disabled = true;
        stopButton.classList.remove('hidden');

        let currentAssistantElement = null;
        let currentSpeakerName = null;
        let assistantResponse = '';
        let allAssistantResponses = []; // 存储所有助手的回复内容

        // 创建AbortController用于取消请求
        currentController = new AbortController();

        try {
            const response = await fetch('/api/group_chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    topic_id: currentTopic.id,
                    session_id: sessionId
                }),
                signal: currentController.signal
            });

            if (!response.ok) {
                throw new Error('Failed to send message');
            }

            // 使用与topics.js相同的流式响应处理方式
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                
                const text = decoder.decode(value);
                const lines = text.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const jsonStr = line.slice(6);
                        if (jsonStr.trim() === '[DONE_GROUP]') {
                            // 重置控制器和界面状态
                            currentController = null;
                            messageInput.disabled = false;
                            sendButton.disabled = false;
                            stopButton.classList.add('hidden');
                            break;
                        }
                        
                        try {
                            const data = JSON.parse(jsonStr);
                            
                            if (data.error) {
                                console.error('API Error:', data.error);
                                // 显示错误消息
                                const errorElement = document.createElement('div');
                                errorElement.className = 'mb-4';
                                errorElement.innerHTML = `
                                    <div class="flex items-start">
                                        <div class="w-8 h-8 rounded-full bg-red-200 flex items-center justify-center mr-3 flex-shrink-0">⚠️</div>
                                        <div class="flex flex-col items-start">
                                            <div class="font-medium text-sm text-red-600 mb-1">系统错误</div>
                                            <div class="max-w-md p-3 rounded-lg bg-red-50 text-red-700">
                                                ${data.error}
                                            </div>
                                        </div>
                                    </div>
                                `;
                                chatMessages.appendChild(errorElement);
                                continue;
                            }

                            // 助手开始说话
                            if (data.type === 'assistant_start') {
                                // 如果有之前的回复，保存到数组中
                                if (currentSpeakerName && assistantResponse.trim()) {
                                    allAssistantResponses.push({
                                        name: currentSpeakerName,
                                        content: assistantResponse.trim()
                                    });
                                }
                                
                                currentSpeakerName = data.speaker_name;
                                assistantResponse = '';
                                currentAssistantElement = renderAssistantMessage(
                                    { role: 'assistant', content: '' }, 
                                    data.speaker_name, 
                                    data.speaker_avatar || '🤖'
                                );
                            }
                            // 助手内容
                            else if (data.type === 'content' && data.choices && data.choices[0] && data.choices[0].delta) {
                                const content = data.choices[0].delta.content;
                                if (content && currentAssistantElement) {
                                    assistantResponse += content;
                                    const contentDiv = currentAssistantElement.querySelector('.message-content');
                                    contentDiv.innerHTML = assistantResponse.replace(/\n/g, '<br>');
                                }
                            }
                            
                        } catch (e) {
                            console.error('Failed to parse SSE data:', jsonStr, e);
                        }
                    }
                }
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }

        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('群组对话被用户停止');
                
                // 保存当前正在进行的助手回复
                if (currentSpeakerName && assistantResponse.trim()) {
                    allAssistantResponses.push({
                        name: currentSpeakerName,
                        content: assistantResponse.trim()
                    });
                }
                
                // 如果有部分回复，保存到数据库
                if (allAssistantResponses.length > 0) {
                    savePartialGroupResponses(allAssistantResponses);
                }
                
                // 显示停止消息
                const stopElement = document.createElement('div');
                stopElement.className = 'mb-4';
                stopElement.innerHTML = `
                    <div class="flex items-start">
                        <div class="w-8 h-8 rounded-full bg-yellow-200 flex items-center justify-center mr-3 flex-shrink-0">⏹️</div>
                        <div class="flex flex-col items-start">
                            <div class="font-medium text-sm text-yellow-600 mb-1">对话已停止</div>
                            <div class="max-w-md p-3 rounded-lg bg-yellow-50 text-yellow-700">
                                群组对话已被用户停止${allAssistantResponses.length > 0 ? '，部分回复已保存' : ''}
                            </div>
                        </div>
                    </div>
                `;
                chatMessages.appendChild(stopElement);
            } else {
                console.error('Error sending message:', error);
                // 显示错误消息
                const errorElement = document.createElement('div');
                errorElement.className = 'mb-4';
                errorElement.innerHTML = `
                    <div class="flex items-start">
                        <div class="w-8 h-8 rounded-full bg-red-200 flex items-center justify-center mr-3 flex-shrink-0">⚠️</div>
                        <div class="flex flex-col items-start">
                            <div class="font-medium text-sm text-red-600 mb-1">发送失败</div>
                            <div class="max-w-md p-3 rounded-lg bg-red-50 text-red-700">
                                发送消息失败，请重试
                            </div>
                        </div>
                    </div>
                `;
                chatMessages.appendChild(errorElement);
            }
        } finally {
            // 恢复界面状态
            currentController = null;
            messageInput.disabled = false;
            sendButton.disabled = false;
            stopButton.classList.add('hidden');
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    function renderAssistantMessage(message, speakerName, speakerAvatar) {
        const messageElement = document.createElement('div');
        messageElement.className = 'mb-4';
        
        messageElement.innerHTML = `
            <div class="flex items-start">
                <div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center mr-3 flex-shrink-0">${speakerAvatar}</div>
                <div class="flex flex-col items-start">
                    <div class="font-medium text-sm text-gray-600 mb-1">${speakerName}</div>
                    <div class="message-content max-w-md p-3 rounded-lg bg-white shadow-sm">
                        ${message.content.replace(/\n/g, '<br>')}
                    </div>
                </div>
            </div>
        `;
        
        chatMessages.appendChild(messageElement);
        return messageElement;
    }

    // 保存部分群组回复
    async function savePartialGroupResponses(responses) {
        if (!currentTopic || responses.length === 0) return;
        
        try {
            for (const response of responses) {
                const saveData = {
                    topic_id: currentTopic.id,
                    session_id: sessionId,
                    content: `[${response.name}]: ${response.content}`
                };
                
                await fetch('/api/save-partial-response', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(saveData)
                });
            }
            console.log('部分群组回复已保存');
        } catch (error) {
            console.error('保存部分回复失败:', error);
        }
    }

    newGroupBtn.addEventListener('click', () => {
        loadAssistants();
        newGroupModal.classList.remove('hidden');
    });

    cancelGroupBtn.addEventListener('click', () => {
        newGroupModal.classList.add('hidden');
    });

    createGroupBtn.addEventListener('click', async () => {
        const name = document.getElementById('group-name-input').value.trim();
        const description = document.getElementById('group-description-input').value.trim();
        const selectedAssistants = Array.from(document.querySelectorAll('input[name="assistants"]:checked')).map(cb => cb.value);

        if (!name) {
            alert('请输入群组名称');
            return;
        }

        if (selectedAssistants.length === 0) {
            alert('请至少选择一个助手');
            return;
        }
        
        try {
            const response = await fetch('/api/groups', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name,
                    description,
                    assistant_ids: selectedAssistants.map(id => parseInt(id, 10))
                })
            });

            if (response.ok) {
                newGroupModal.classList.add('hidden');
                loadGroups();
                document.getElementById('group-name-input').value = '';
                document.getElementById('group-description-input').value = '';
            } else {
                const errorData = await response.json();
                alert(`创建失败: ${errorData.error}`);
            }
        } catch(error) {
            console.error(error);
            alert('创建群组时发生错误');
        }
    });

    // 事件监听器
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // 停止AI响应
    function stopGroupChat() {
        if (currentController) {
            currentController.abort();
            currentController = null;
            console.log('群组对话已被用户停止');
        }
        // 立即恢复界面状态
        messageInput.disabled = false;
        sendButton.disabled = false;
        stopButton.classList.add('hidden');
        messageInput.focus();
    }
    
    stopButton.addEventListener('click', stopGroupChat);

    // 群组编辑相关功能
    const editGroupBtn = document.getElementById('edit-group-btn');
    const editGroupModal = document.getElementById('edit-group-modal');
    const closeEditGroupModal = document.getElementById('close-edit-group-modal');
    const cancelEditGroupBtn = document.getElementById('cancel-edit-group-btn');
    const saveGroupBtn = document.getElementById('save-group-btn');
    const editGroupNameInput = document.getElementById('edit-group-name-input');
    const editGroupDescriptionInput = document.getElementById('edit-group-description-input');

    // 显示编辑群组模态框
    function showEditGroupModal() {
        if (!currentGroup) return;
        
        editingGroup = currentGroup;
        editGroupNameInput.value = currentGroup.name;
        editGroupDescriptionInput.value = currentGroup.description || '';
        editGroupModal.classList.remove('hidden');
        
        // 聚焦到名称输入框
        setTimeout(() => {
            editGroupNameInput.focus();
            editGroupNameInput.select();
        }, 100);
    }

    // 隐藏编辑群组模态框
    function hideEditGroupModal() {
        editGroupModal.classList.add('hidden');
        editingGroup = null;
        editGroupNameInput.value = '';
        editGroupDescriptionInput.value = '';
    }

    // 保存群组更改
    async function saveGroupChanges() {
        if (!editingGroup) return;
        
        const name = editGroupNameInput.value.trim();
        const description = editGroupDescriptionInput.value.trim();
        
        if (!name) {
            alert('群组名称不能为空');
            return;
        }
        
        try {
            const response = await fetch(`/api/groups/${editingGroup.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name,
                    description: description
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                
                // 更新当前群组信息
                if (currentGroup && currentGroup.id === editingGroup.id) {
                    currentGroup = result.group;
                    updateGroupHeader(currentGroup);
                }
                
                // 重新加载群组列表
                await loadGroups();
                
                // 隐藏模态框
                hideEditGroupModal();
                
                alert('群组更新成功');
            } else {
                const error = await response.json();
                alert(error.error || '更新失败');
            }
        } catch (error) {
            console.error('更新群组失败:', error);
            alert('更新群组失败，请重试');
        }
    }

    // 编辑按钮事件
    editGroupBtn.addEventListener('click', showEditGroupModal);

    // 关闭模态框事件
    closeEditGroupModal.addEventListener('click', hideEditGroupModal);
    cancelEditGroupBtn.addEventListener('click', hideEditGroupModal);

    // 保存按钮事件
    saveGroupBtn.addEventListener('click', saveGroupChanges);

    // 回车保存
    editGroupNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            saveGroupChanges();
        }
    });

    // 点击模态框外部关闭
    editGroupModal.addEventListener('click', function(e) {
        if (e.target === this) {
            hideEditGroupModal();
        }
    });

    // 删除群组功能
    async function deleteGroup() {
        if (!currentGroup) return;
        
        if (!confirm(`确定要删除群组"${currentGroup.name}"吗？此操作不可撤销，将删除群组及其所有聊天记录。`)) {
            return;
        }
        
        try {
            const response = await fetch(`/api/groups/${currentGroup.id}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                // 重新加载群组列表
                await loadGroups();
                
                // 清空聊天区域并显示欢迎屏幕
                currentGroup = null;
                currentTopic = null;
                document.getElementById('chat-messages').innerHTML = '';
                document.getElementById('group-header').classList.add('hidden');
                document.getElementById('input-area').classList.add('hidden');
                showWelcomeScreen();
                
                alert('群组删除成功');
            } else {
                const error = await response.json();
                alert(error.error || '删除失败');
            }
        } catch (error) {
            console.error('删除群组失败:', error);
            alert('删除群组失败，请重试');
        }
    }

    // 删除群组按钮事件
    document.getElementById('delete-group-btn').addEventListener('click', deleteGroup);

    // 初始化
    showWelcomeScreen();
    loadGroups();
});
