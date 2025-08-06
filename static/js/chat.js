// 生成唯一的会话ID
function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// 当前会话ID
const sessionId = generateSessionId();

// 当前选中的角色
let currentRole = 'operation_expert';

// 当前话题ID
let currentTopicId = null;

// 从URL参数获取话题ID
function getTopicIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('topic');
}

// 初始化页面
document.addEventListener('DOMContentLoaded', function() {
    // 获取话题ID
    currentTopicId = getTopicIdFromUrl();
    
    // 如果有话题ID，加载话题数据
    if (currentTopicId) {
        loadTopicData(currentTopicId);
    }

    // 角色选择
    document.querySelectorAll('.role-select').forEach(element => {
        element.addEventListener('click', function() {
            // 移除其他角色的选中状态
            document.querySelectorAll('.role-select').forEach(el => {
                el.classList.remove('bg-gray-200');
            });
            // 添加当前角色的选中状态
            this.classList.add('bg-gray-200');
            currentRole = this.dataset.role;
        });
    });

    // 发送消息
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const chatMessages = document.getElementById('chat-messages');

    // 加载话题数据
    async function loadTopicData(topicId) {
        try {
            const response = await fetch(`/api/topics/${topicId}`);
            if (response.ok) {
                const data = await response.json();
                const topic = data.topic;
                
                // 设置当前角色为话题的角色
                currentRole = topic.role;
                
                // 高亮对应的角色选择器
                document.querySelectorAll('.role-select').forEach(el => {
                    el.classList.remove('bg-gray-200');
                    if (el.dataset.role === topic.role) {
                        el.classList.add('bg-gray-200');
                    }
                });
                
                // 加载历史对话
                data.conversations.forEach(conv => {
                    addMessage(conv.role, conv.content);
                });
            }
        } catch (error) {
            console.error('加载话题数据失败:', error);
        }
    }

    function addMessage(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `flex ${role === 'user' ? 'justify-end' : 'justify-start'} mb-4`;
        
        const messageContent = document.createElement('div');
        messageContent.className = `max-w-2xl p-4 rounded-lg ${role === 'user' ? 'bg-green-600 text-white' : 'bg-white shadow'}`;
        messageContent.textContent = content;
        
        messageDiv.appendChild(messageContent);
        chatMessages.appendChild(messageDiv);
        
        // 滚动到底部
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return messageContent;
    }

    async function sendMessage() {
        const message = messageInput.value.trim();
        if (!message) return;

        // 禁用输入和发送按钮
        messageInput.disabled = true;
        sendButton.disabled = true;

        // 添加用户消息到界面
        addMessage('user', message);

        // 创建AI响应的消息容器
        const aiMessageContent = addMessage('assistant', '');
        let aiResponse = '';

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
                })
            });

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
                            break;
                        }
                        try {
                            const data = JSON.parse(jsonStr);
                            if (data.choices && data.choices[0] && data.choices[0].delta) {
                                const content = data.choices[0].delta.content;
                                if (content) {
                                    aiResponse += content;
                                    aiMessageContent.textContent = aiResponse;
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
            console.error('Error:', error);
            aiMessageContent.textContent = '发送消息失败，请重试';
            aiMessageContent.classList.add('text-red-500');
        } finally {
            // 重新启用输入和发送按钮
            messageInput.disabled = false;
            sendButton.disabled = false;
            messageInput.value = '';
            messageInput.focus();
        }
    }

    // 发送按钮点击事件
    sendButton.addEventListener('click', sendMessage);

    // 回车发送
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
});