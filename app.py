from flask import Flask, render_template, request, jsonify, Response, session, send_from_directory
from flask_sqlalchemy import SQLAlchemy
import json
import os
import requests
from datetime import datetime
from config import Config, ROLES
import uuid
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///chat.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
app.secret_key = os.urandom(24)

# 配置文件上传
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx'}

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

db = SQLAlchemy(app)

# 数据库模型
class Settings(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    aliyun_api_key = db.Column(db.String(200))
    aliyun_model = db.Column(db.String(50), default='qwen-plus')
    guiji_api_key = db.Column(db.String(200))
    google_api_key = db.Column(db.String(200))

class Topic(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    role = db.Column(db.String(50), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Conversation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    role = db.Column(db.String(50))
    content = db.Column(db.Text)
    session_id = db.Column(db.String(100))
    topic_id = db.Column(db.String(36), db.ForeignKey('topic.id'))

class RolePrompt(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    role_key = db.Column(db.String(50), unique=True, nullable=False)
    description = db.Column(db.String(200))
    prompt = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Assistant(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(500))
    avatar = db.Column(db.String(200))  # emoji或者图片URL
    avatar_type = db.Column(db.String(10), default='emoji')  # 'emoji' 或 'image'
    role_key = db.Column(db.String(50), unique=True, nullable=False)
    is_default = db.Column(db.Boolean, default=False)  # 是否为默认助手
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# 多对多关联表
group_assistants = db.Table('group_assistants',
    db.Column('group_id', db.Integer, db.ForeignKey('group.id'), primary_key=True),
    db.Column('assistant_id', db.Integer, db.ForeignKey('assistant.id'), primary_key=True)
)

class Group(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    description = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    assistants = db.relationship('Assistant', secondary=group_assistants, lazy='subquery',
        backref=db.backref('groups', lazy=True))


# 创建数据库表
with app.app_context():
    db.create_all()
    # 确保至少有一条设置记录
    if not Settings.query.first():
        default_settings = Settings(
            aliyun_api_key='sk-044b96708e89453787a9033ab9c6bf33',
            aliyun_model='qwen-plus',
            guiji_api_key='sk-bbkkyosdmrmefanavzozynuiitttznnqyeaeigstehknjtyo',
            google_api_key='AIzaSyChFtVe6nPHW5nT9J6i8QBXbka5LJVKVko'
        )
        db.session.add(default_settings)
        db.session.commit()
    
    # 确保默认助手存在
    if not Assistant.query.filter_by(is_default=True).first():
        default_assistants = [
            Assistant(name='运营官', description='数据驱动×创意破壁双引擎运营官', avatar='👨‍💼', role_key='operation_expert', is_default=True),
            Assistant(name='产品经理', description='产品规划专家', avatar='📱', role_key='product_manager', is_default=True),
            Assistant(name='市场营销经理', description='市场推广专家', avatar='📈', role_key='marketing_manager', is_default=True),
            Assistant(name='数据分析师', description='数据洞察专家', avatar='📊', role_key='data_analyst', is_default=True),
            Assistant(name='内容策划', description='内容创作专家', avatar='✍️', role_key='content_strategist', is_default=True)
        ]
        for assistant in default_assistants:
            db.session.add(assistant)
        db.session.commit()

def get_settings():
    settings = Settings.query.first()
    if not settings:
        settings = Settings()
        db.session.add(settings)
        db.session.commit()
    return settings

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def test_aliyun_api(api_key, test_input):
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    data = {
        "model": "qwen-plus",
        "messages": [
            {
                "role": "user",
                "content": test_input
            }
        ]
    }
    
    response = requests.post(
        "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
        headers=headers,
        json=data
    )
    
    return response.json()

def test_guiji_api(api_key, test_input):
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    data = {
        "messages": [
            {
                "role": "user",
                "content": test_input
            }
        ]
    }
    
    response = requests.post(
        "https://api.guiji.ai/v1/chat/completions",
        headers=headers,
        json=data
    )
    
    return response.json()

def test_google_search(api_key, query):
    params = {
        'key': api_key,
        'cx': '017576662512468239146:omuauf_lfve',
        'q': query
    }
    
    response = requests.get(
        'https://www.googleapis.com/customsearch/v1',
        params=params
    )
    
    return response.json()

@app.route('/')
def index():
    topic_id = request.args.get('topic')
    assistants = Assistant.query.order_by(Assistant.is_default.desc(), Assistant.created_at.asc()).all()
    return render_template('index.html', assistants=assistants, topic_id=topic_id)

@app.route('/topics')
def topics():
    return render_template('topics.html')

@app.route('/settings')
def settings():
    current_settings = get_settings()
    return render_template('settings.html', 
                         aliyun_api_key=current_settings.aliyun_api_key,
                         aliyun_model=current_settings.aliyun_model,
                         guiji_api_key=current_settings.guiji_api_key,
                         google_api_key=current_settings.google_api_key)

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    """提供上传文件的访问路由"""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/api/topics', methods=['GET'])
def get_topics():
    role = request.args.get('role')
    if role:
        topics = Topic.query.filter_by(role=role).order_by(Topic.updated_at.desc()).all()
    else:
        topics = Topic.query.order_by(Topic.updated_at.desc()).all()
    
    return jsonify([{
        'id': topic.id,
        'title': topic.title,
        'description': topic.description,
        'role': topic.role,
        'created_at': topic.created_at.isoformat(),
        'updated_at': topic.updated_at.isoformat()
    } for topic in topics])

@app.route('/api/topics', methods=['POST'])
def create_topic():
    try:
        data = request.json
        new_topic = Topic(
            title=data['title'],
            description=data.get('description', ''),
            role=data['role']
        )
        db.session.add(new_topic)
        db.session.commit()
        
        return jsonify({
            'id': new_topic.id,
            'title': new_topic.title,
            'description': new_topic.description,
            'role': new_topic.role,
            'created_at': new_topic.created_at.isoformat(),
            'updated_at': new_topic.updated_at.isoformat()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/topics/<topic_id>', methods=['GET'])
def get_topic(topic_id):
    topic = Topic.query.get_or_404(topic_id)
    conversations = Conversation.query.filter_by(topic_id=topic_id).order_by(Conversation.timestamp).all()
    
    return jsonify({
        'topic': {
            'id': topic.id,
            'title': topic.title,
            'description': topic.description,
            'role': topic.role,
            'created_at': topic.created_at.isoformat(),
            'updated_at': topic.updated_at.isoformat()
        },
        'conversations': [{
            'id': conv.id,
            'role': conv.role,
            'content': conv.content,
            'timestamp': conv.timestamp.isoformat()
        } for conv in conversations]
    })

@app.route('/api/settings', methods=['POST'])
def update_settings():
    try:
        data = request.json
        settings = get_settings()
        
        if 'aliyun_api_key' in data:
            settings.aliyun_api_key = data['aliyun_api_key']
        if 'aliyun_model' in data:
            settings.aliyun_model = data['aliyun_model']
        if 'guiji_api_key' in data:
            settings.guiji_api_key = data['guiji_api_key']
        if 'google_api_key' in data:
            settings.google_api_key = data['google_api_key']
        
        db.session.commit()
        return jsonify({"status": "success", "message": "设置已更新"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/test/aliyun', methods=['POST'])
def test_aliyun():
    try:
        data = request.json
        api_key = data.get('api_key')
        test_input = data.get('test_input', '你好，请做个简单的自我介绍')
        
        if not api_key:
            return jsonify({"error": "API密钥不能为空"}), 400
            
        result = test_aliyun_api(api_key, test_input)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/test/guiji', methods=['POST'])
def test_guiji():
    try:
        data = request.json
        api_key = data.get('api_key')
        test_input = data.get('test_input', '你好，请做个简单的自我介绍')
        
        if not api_key:
            return jsonify({"error": "API密钥不能为空"}), 400
            
        result = test_guiji_api(api_key, test_input)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/test/google', methods=['POST'])
def test_google():
    try:
        data = request.json
        api_key = data.get('api_key')
        test_input = data.get('test_input', 'Hello World')
        
        if not api_key:
            return jsonify({"error": "API密钥不能为空"}), 400
            
        result = test_google_search(api_key, test_input)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        message = data.get('message')
        role = data.get('role', 'operation_expert')
        session_id = data.get('session_id')
        topic_id = data.get('topic_id')

        if not message:
            return jsonify({"error": "No message provided"}), 400

        settings = get_settings()
        if not settings.aliyun_api_key:
            return jsonify({"error": "请先在设置页面配置API密钥"}), 400

        # 构建消息历史
        role_prompt = get_role_prompt(role)
        messages = [
            {
                "role": "system",
                "content": role_prompt
            },
            {
                "role": "user",
                "content": message
            }
        ]

        # 保存用户消息到数据库
        new_message = Conversation(
            role='user',
            content=message,
            session_id=session_id,
            topic_id=topic_id
        )
        db.session.add(new_message)
        db.session.commit()

        # 如果有话题ID，更新话题的更新时间
        if topic_id:
            topic = Topic.query.get(topic_id)
            if topic:
                topic.updated_at = datetime.utcnow()
                db.session.commit()

        headers = {
            "Authorization": f"Bearer {settings.aliyun_api_key}",
            "Content-Type": "application/json"
        }
        
        request_data = {
            "model": settings.aliyun_model,
            "messages": messages,
            "stream": True
        }

        def generate():
            response = requests.post(
                "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
                headers=headers,
                json=request_data,
                stream=True
            )
            
            if response.status_code != 200:
                yield f"data: {json.dumps({'error': '调用API失败'})}\n\n"
                return

            for line in response.iter_lines():
                if line:
                    line = line.decode('utf-8')
                    if line.startswith('data: '):
                        yield f"{line}\n\n"

        return Response(generate(), mimetype='text/event-stream')
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/roles', methods=['GET'])
def get_roles():
    try:
        # 获取所有助手信息
        assistants = Assistant.query.all()
        result = {}
        
        # 为每个助手构建角色信息
        for assistant in assistants:
            # 获取该助手的prompt（优先级：自定义 > config.py预设 > 自动生成）
            prompt = get_role_prompt(assistant.role_key)
            
            result[assistant.role_key] = {
                'name': assistant.name,
                'icon': assistant.avatar if assistant.avatar_type == 'emoji' else assistant.avatar,
                'avatar_type': assistant.avatar_type,
                'description': assistant.description or '专业助手',
                'prompt': prompt
            }
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/roles', methods=['POST'])
def update_role():
    try:
        data = request.json
        role_key = data.get('role')
        description = data.get('description')
        prompt = data.get('prompt')
        
        if not role_key:
            return jsonify({"error": "Role key is required"}), 400
        
        # 检查助手是否存在
        assistant = Assistant.query.filter_by(role_key=role_key).first()
        if not assistant:
            return jsonify({"error": "Assistant not found"}), 404
        
        # 查找或创建角色prompt记录
        role_prompt = RolePrompt.query.filter_by(role_key=role_key).first()
        if not role_prompt:
            role_prompt = RolePrompt(role_key=role_key)
            db.session.add(role_prompt)
        
        role_prompt.description = description
        role_prompt.prompt = prompt
        role_prompt.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({"status": "success", "message": "角色设定已更新"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/roles/<role_key>/reset', methods=['POST'])
def reset_role_to_default(role_key):
    try:
        # 检查助手是否存在
        assistant = Assistant.query.filter_by(role_key=role_key).first()
        if not assistant:
            return jsonify({"error": "Assistant not found"}), 404
        
        # 删除自定义设置，恢复默认
        role_prompt = RolePrompt.query.filter_by(role_key=role_key).first()
        if role_prompt:
            db.session.delete(role_prompt)
            db.session.commit()
        
        # 返回默认配置（优先使用config.py中的预设）
        default_prompt = ''
        if role_key in ROLES and ROLES[role_key].get('prompt'):
            default_prompt = ROLES[role_key]['prompt']
        else:
            default_prompt = f'你是{assistant.name}，{assistant.description or "一个专业的AI助手"}。请根据用户的问题提供专业、准确、有用的回答。'
        
        return jsonify({
            'description': assistant.description or '专业助手',
            'prompt': default_prompt
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def get_role_prompt(role_key):
    """获取角色的prompt，优先使用自定义设置"""
    custom_prompt = RolePrompt.query.filter_by(role_key=role_key).first()
    if custom_prompt and custom_prompt.prompt:
        return custom_prompt.prompt
    
    # 如果没有自定义prompt，优先使用config.py中的预设prompt
    if role_key in ROLES and ROLES[role_key].get('prompt'):
        return ROLES[role_key]['prompt']
    
    # 如果config.py中也没有，根据助手信息生成默认prompt
    assistant = Assistant.query.filter_by(role_key=role_key).first()
    if assistant:
        return f'你是{assistant.name}，{assistant.description or "一个专业的AI助手"}。请根据用户的问题提供专业、准确、有用的回答。'
    
    return ''

def allowed_file(filename):
    """检查文件扩展名是否允许"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/api/save-partial-response', methods=['POST'])
def save_partial_response():
    """保存被用户停止的部分AI回答"""
    try:
        data = request.json
        topic_id = data.get('topic_id')
        session_id = data.get('session_id')
        content = data.get('content')
        
        if not all([topic_id, session_id, content]):
            return jsonify({"error": "Missing required fields"}), 400
        
        # 保存AI响应到数据库
        ai_message = Conversation(
            role='assistant',
            content=content,
            session_id=session_id,
            topic_id=topic_id
        )
        db.session.add(ai_message)
        
        # 更新话题的更新时间
        topic = Topic.query.get(topic_id)
        if topic:
            topic.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/save-complete-response', methods=['POST'])
def save_complete_response():
    """保存完整的AI回答"""
    try:
        data = request.json
        topic_id = data.get('topic_id')
        session_id = data.get('session_id')
        content = data.get('content')
        
        if not all([topic_id, session_id, content]):
            return jsonify({"error": "Missing required fields"}), 400
        
        # 保存AI响应到数据库
        ai_message = Conversation(
            role='assistant',
            content=content,
            session_id=session_id,
            topic_id=topic_id
        )
        db.session.add(ai_message)
        
        # 更新话题的更新时间
        topic = Topic.query.get(topic_id)
        if topic:
            topic.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/upload-files', methods=['POST'])
def upload_files():
    """处理文件上传"""
    try:
        topic_id = request.form.get('topic_id')
        session_id = request.form.get('session_id')
        
        if not topic_id or not session_id:
            return jsonify({"error": "Missing topic_id or session_id"}), 400
        
        uploaded_files = []
        file_urls = []
        
        # 处理上传的文件
        for key in request.files:
            file = request.files[key]
            if file and file.filename != '' and allowed_file(file.filename):
                # 安全的文件名
                filename = secure_filename(file.filename)
                # 添加时间戳避免文件名冲突
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                filename = f"{timestamp}_{filename}"
                
                # 保存文件
                file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                file.save(file_path)
                
                uploaded_files.append(filename)
                file_urls.append(f"/uploads/{filename}")
        
        if not uploaded_files:
            return jsonify({"error": "No valid files uploaded"}), 400
        
        return jsonify({
            "status": "success",
            "files": uploaded_files,
            "file_urls": file_urls,
            "message": f"Successfully uploaded {len(uploaded_files)} file(s)"
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/topics/<int:topic_id>', methods=['PUT'])
def update_topic(topic_id):
    """更新话题信息"""
    try:
        data = request.get_json()
        title = data.get('title', '').strip()
        description = data.get('description', '').strip()
        
        if not title:
            return jsonify({"error": "话题标题不能为空"}), 400
        
        # 查找话题
        topic = Topic.query.get(topic_id)
        if not topic:
            return jsonify({"error": "话题不存在"}), 404
        
        # 更新话题信息
        topic.title = title
        topic.description = description
        topic.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            "status": "success",
            "message": "话题更新成功",
            "topic": {
                "id": topic.id,
                "title": topic.title,
                "description": topic.description,
                "role": topic.role,
                "created_at": topic.created_at.isoformat(),
                "updated_at": topic.updated_at.isoformat()
            }
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# 助手管理API
@app.route('/api/assistants', methods=['GET'])
def get_assistants():
    """获取所有助手列表"""
    try:
        assistants = Assistant.query.order_by(Assistant.is_default.desc(), Assistant.created_at.asc()).all()
        return jsonify({
            "assistants": [{
                "id": assistant.id,
                "name": assistant.name,
                "description": assistant.description,
                "avatar": assistant.avatar,
                "avatar_type": assistant.avatar_type,
                "role_key": assistant.role_key,
                "is_default": assistant.is_default,
                "created_at": assistant.created_at.isoformat(),
                "updated_at": assistant.updated_at.isoformat()
            } for assistant in assistants]
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/upload-avatar', methods=['POST'])
def upload_avatar():
    """上传助手头像"""
    try:
        if 'avatar' not in request.files:
            return jsonify({"error": "没有选择文件"}), 400
        
        file = request.files['avatar']
        if file.filename == '':
            return jsonify({"error": "没有选择文件"}), 400
        
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            # 添加时间戳避免文件名冲突
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_')
            filename = timestamp + filename
            
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(file_path)
            
            # 返回文件URL
            file_url = f'/uploads/{filename}'
            return jsonify({
                "status": "success",
                "file_url": file_url
            })
        else:
            return jsonify({"error": "不支持的文件类型"}), 400
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/assistants', methods=['POST'])
def create_assistant():
    """创建新助手"""
    try:
        data = request.get_json()
        name = data.get('name', '').strip()
        description = data.get('description', '').strip()
        avatar = data.get('avatar', '').strip()
        avatar_type = data.get('avatar_type', 'emoji')
        
        if not name:
            return jsonify({"error": "助手名称不能为空"}), 400
        
        if not avatar:
            return jsonify({"error": "请选择助手头像"}), 400
        
        # 生成唯一的role_key
        import re
        role_key = re.sub(r'[^a-zA-Z0-9_]', '', name.lower().replace(' ', '_'))
        if not role_key:
            role_key = f"custom_assistant_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        # 确保role_key唯一
        counter = 1
        original_role_key = role_key
        while Assistant.query.filter_by(role_key=role_key).first():
            role_key = f"{original_role_key}_{counter}"
            counter += 1
        
        # 创建新助手
        new_assistant = Assistant(
            name=name,
            description=description,
            avatar=avatar,
            avatar_type=avatar_type,
            role_key=role_key,
            is_default=False
        )
        
        db.session.add(new_assistant)
        db.session.commit()
        
        return jsonify({
            "status": "success",
            "message": "助手创建成功",
            "assistant": {
                "id": new_assistant.id,
                "name": new_assistant.name,
                "description": new_assistant.description,
                "avatar": new_assistant.avatar,
                "avatar_type": new_assistant.avatar_type,
                "role_key": new_assistant.role_key,
                "is_default": new_assistant.is_default,
                "created_at": new_assistant.created_at.isoformat(),
                "updated_at": new_assistant.updated_at.isoformat()
            }
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/assistants/<int:assistant_id>', methods=['DELETE'])
def delete_assistant(assistant_id):
    """删除助手"""
    try:
        assistant = Assistant.query.get(assistant_id)
        if not assistant:
            return jsonify({"error": "助手不存在"}), 404
        
        if assistant.is_default:
            return jsonify({"error": "不能删除默认助手"}), 400
        
        db.session.delete(assistant)
        db.session.commit()
        
        return jsonify({
            "status": "success",
            "message": "助手删除成功"
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/groups')
def groups():
    return render_template('groups.html')

# 群组管理API
@app.route('/api/groups', methods=['GET'])
def get_groups():
    try:
        groups = Group.query.order_by(Group.created_at.asc()).all()
        result = []
        for group in groups:
            result.append({
                "id": group.id,
                "name": group.name,
                "description": group.description,
                "created_at": group.created_at.isoformat(),
                "updated_at": group.updated_at.isoformat(),
                "assistants": [{
                    "id": assistant.id,
                    "name": assistant.name,
                    "avatar": assistant.avatar,
                    "avatar_type": assistant.avatar_type,
                    "role_key": assistant.role_key
                } for assistant in group.assistants]
            })
        return jsonify({"groups": result})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/groups', methods=['POST'])
def create_group():
    try:
        data = request.get_json()
        name = data.get('name', '').strip()
        description = data.get('description', '').strip()
        assistant_ids = data.get('assistant_ids', [])

        if not name:
            return jsonify({"error": "群组名称不能为空"}), 400
        if not assistant_ids:
            return jsonify({"error": "群组成员不能为空"}), 400

        if Group.query.filter_by(name=name).first():
            return jsonify({"error": "群组名称已存在"}), 400

        new_group = Group(name=name, description=description)
        
        assistants = Assistant.query.filter(Assistant.id.in_(assistant_ids)).all()
        if len(assistants) != len(assistant_ids):
            # Find which IDs are invalid
            found_ids = {a.id for a in assistants}
            invalid_ids = [aid for aid in assistant_ids if aid not in found_ids]
            return jsonify({"error": f"一个或多个助手ID无效: {invalid_ids}"}), 400
            
        for assistant in assistants:
            new_group.assistants.append(assistant)

        db.session.add(new_group)
        db.session.commit()

        # Manually construct the assistant list for the response to ensure it's fresh
        group_assistants_data = [{
            "id": assistant.id,
            "name": assistant.name,
            "avatar": assistant.avatar,
            "avatar_type": assistant.avatar_type,
            "role_key": assistant.role_key
        } for assistant in new_group.assistants]

        return jsonify({
            "status": "success",
            "message": "群组创建成功",
            "group": {
                "id": new_group.id,
                "name": new_group.name,
                "description": new_group.description,
                "created_at": new_group.created_at.isoformat(),
                "updated_at": new_group.updated_at.isoformat(),
                "assistants": group_assistants_data
            }
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/groups/<int:group_id>/topic', methods=['GET'])
def get_or_create_group_topic(group_id):
    """为群组获取或创建对应的话题"""
    try:
        group = Group.query.get_or_404(group_id)
        
        # 查找是否已存在该群组的话题
        existing_topic = Topic.query.filter_by(title=f"群组:{group.name}", role='group').first()
        
        if existing_topic:
            return jsonify({
                'id': existing_topic.id,
                'title': existing_topic.title,
                'description': existing_topic.description,
                'role': existing_topic.role,
                'created_at': existing_topic.created_at.isoformat(),
                'updated_at': existing_topic.updated_at.isoformat()
            })
        
        # 创建新的群组话题
        new_topic = Topic(
            title=f"群组:{group.name}",
            description=f"群组 {group.name} 的对话",
            role='group'
        )
        db.session.add(new_topic)
        db.session.commit()
        
        return jsonify({
            'id': new_topic.id,
            'title': new_topic.title,
            'description': new_topic.description,
            'role': new_topic.role,
            'created_at': new_topic.created_at.isoformat(),
            'updated_at': new_topic.updated_at.isoformat()
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/group_chat', methods=['POST'])
def group_chat():
    """处理群组对话"""
    try:
        data = request.json
        message = data.get('message')
        topic_id = data.get('topic_id')
        session_id = data.get('session_id')
        user_as_role_key = data.get('user_as_role_key', 'user')

        if not message or not topic_id:
            return jsonify({"error": "缺少必要参数"}), 400

        settings = get_settings()
        if not settings.aliyun_api_key:
            return jsonify({"error": "请先在设置页面配置API密钥"}), 400

        # 获取话题信息
        topic = Topic.query.get_or_404(topic_id)
        
        # 获取群组信息，并预加载关联的助手数据
        group_name = topic.title.replace("群组:", "")
        group = Group.query.filter_by(name=group_name).first()
        if not group:
            return jsonify({"error": "找不到对应的群组"}), 404
        
        # 预加载助手数据，避免懒加载问题
        assistants_data = []
        for assistant in group.assistants:
            assistants_data.append({
                'id': assistant.id,
                'name': assistant.name,
                'avatar': assistant.avatar,
                'avatar_type': assistant.avatar_type,
                'role_key': assistant.role_key,
                'description': assistant.description
            })

        # 保存群组名称和设置信息，避免在生成器中使用SQLAlchemy对象
        group_name = group.name
        
        # 🔥 预加载settings数据，避免在生成器中访问脱离会话的对象
        aliyun_api_key = settings.aliyun_api_key
        aliyun_model = settings.aliyun_model
        
        # 🔥 关键修复：在commit()之前预加载所有数据，确保在同一个会话中
        for assistant_data in assistants_data:
            try:
                # 直接在这里处理role prompt逻辑，避免调用可能有会话问题的函数
                role_key = assistant_data['role_key']
                
                # 首先尝试获取自定义prompt（在commit之前查询！）
                custom_prompt = RolePrompt.query.filter_by(role_key=role_key).first()
                if custom_prompt and custom_prompt.prompt:
                    assistant_data['role_prompt'] = custom_prompt.prompt
                elif role_key in ROLES and ROLES[role_key].get('prompt'):
                    # 使用config.py中的预设prompt
                    assistant_data['role_prompt'] = ROLES[role_key]['prompt']
                else:
                    # 使用已经预加载的助手信息生成默认prompt，不重新查询数据库
                    assistant_data['role_prompt'] = f'你是{assistant_data["name"]}，{assistant_data.get("description", "一个专业的AI助手")}。请根据用户的问题提供专业、准确、有用的回答。'
                    
            except Exception as e:
                print(f"Error getting role prompt for {assistant_data['name']}: {e}")
                assistant_data['role_prompt'] = f'你是{assistant_data["name"]}，{assistant_data.get("description", "一个专业的AI助手")}。请根据用户的问题提供专业、准确、有用的回答。'

        # 保存用户消息到数据库
        user_message = Conversation(
            role='user',
            content=message,
            session_id=session_id,
            topic_id=topic_id
        )
        db.session.add(user_message)
        
        # 更新话题时间
        topic.updated_at = datetime.utcnow()
        
        # 🔥 现在提交，所有预加载都已完成，不再需要访问数据库
        db.session.commit()

        # 为群组中的每个助手生成回复
        def generate_group_responses():
            try:
                for assistant_data in assistants_data:
                    try:
                        # 使用预加载的角色设定
                        role_prompt = assistant_data.get('role_prompt', f'你是{assistant_data["name"]}，一个专业的AI助手。')
                        
                        # 构建消息
                        messages = [
                            {
                                "role": "system",
                                "content": f"{role_prompt}\n\n你现在参与一个群组讨论，群组名称是'{group_name}'。请以你的专业角色身份参与讨论，提供有价值的观点。"
                            },
                            {
                                "role": "user",
                                "content": message
                            }
                        ]

                        headers = {
                            "Authorization": f"Bearer {aliyun_api_key}",
                            "Content-Type": "application/json"
                        }
                        
                        request_data = {
                            "model": aliyun_model,
                            "messages": messages,
                            "stream": True
                        }

                        # 发送助手开始说话的信号
                        start_signal = {
                            'type': 'assistant_start',
                            'speaker_role_key': assistant_data['role_key'],
                            'speaker_name': assistant_data['name'],
                            'speaker_avatar': assistant_data['avatar'],
                            'choices': [{'delta': {'content': ''}}]
                        }
                        yield f"data: {json.dumps(start_signal)}\n\n"

                        response = requests.post(
                            "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
                            headers=headers,
                            json=request_data,
                            stream=True
                        )
                        
                        if response.status_code != 200:
                            error_msg = {
                                'type': 'error',
                                'error': f'{assistant_data["name"]} API调用失败',
                                'assistant_name': assistant_data['name']
                            }
                            yield f"data: {json.dumps(error_msg)}\n\n"
                            continue

                        assistant_response_content = ""
                        try:
                            for line in response.iter_lines():
                                if line:
                                line = line.decode('utf-8')
                                if line.startswith('data: '):
                                    line_data = line[6:].strip()
                                    if line_data == '[DONE]':
                                        break
                                    
                                    try:
                                        chunk = json.loads(line_data)
                                        content = chunk.get('choices', [{}])[0].get('delta', {}).get('content', '')
                                        if content:
                                            assistant_response_content += content
                                            # 添加说话者信息
                                            modified_chunk = {
                                                'type': 'content',
                                                'speaker_role_key': assistant_data['role_key'],
                                                'speaker_name': assistant_data['name'],
                                                'speaker_avatar': assistant_data['avatar'],
                                                'choices': chunk.get('choices', [])
                                            }
                                            yield f"data: {json.dumps(modified_chunk)}\n\n"
                                    except json.JSONDecodeError as e:
                                        print(f"JSON decode error: {e}, line_data: {line_data}")
                                        continue
                        except Exception as stream_error:
                            print(f"Stream interrupted for {assistant_data['name']}: {stream_error}")
                            # 连接被中断，停止当前助手的处理
                            break

                        # 保存助手回复到数据库
                        if assistant_response_content.strip():
                            with app.app_context():
                                # 创建新的数据库会话来避免会话绑定问题
                                assistant_message = Conversation(
                                    role='assistant',
                                    content=assistant_response_content,
                                    session_id=session_id,
                                    topic_id=topic_id
                                )
                                db.session.add(assistant_message)
                                # 立即提交这个助手的回复
                                try:
                                    db.session.commit()
                                except Exception as commit_error:
                                    print(f"Failed to commit assistant message: {commit_error}")
                                    db.session.rollback()
                            
                    except Exception as e:
                        print(f"Error processing assistant {assistant_data['name']}: {e}")
                        error_msg = {
                            'type': 'error',
                            'error': f'{assistant_data["name"]}: {str(e)}',
                            'assistant_name': assistant_data['name']
                        }
                        yield f"data: {json.dumps(error_msg)}\n\n"

                # 所有助手回复已经单独提交，这里不需要再次提交
                    
                # 发送完成信号
                yield f"data: [DONE_GROUP]\n\n"
                
            except Exception as e:
                print(f"Fatal error in generate_group_responses: {e}")
                with app.app_context():
                    error_msg = {
                        'type': 'error',
                        'error': f'群组聊天出现错误: {str(e)}'
                    }
                yield f"data: {json.dumps(error_msg)}\n\n"

        return Response(generate_group_responses(), mimetype='text/event-stream')
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)