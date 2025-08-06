import sqlite3
import os

# 数据库文件路径
db_path = 'chat.db'
instance_db_path = '../instance/chat.db'

def migrate_database():
    # 检查数据库文件位置
    if os.path.exists(instance_db_path):
        db_file = instance_db_path
    elif os.path.exists(db_path):
        db_file = db_path
    else:
        print("数据库文件不存在，将创建新的数据库")
        return

    print(f"正在迁移数据库: {db_file}")
    
    try:
        conn = sqlite3.connect(db_file)
        cursor = conn.cursor()
        
        # 检查 conversation 表是否存在 topic_id 字段
        cursor.execute("PRAGMA table_info(conversation)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'topic_id' not in columns:
            print("添加 topic_id 字段到 conversation 表")
            cursor.execute("ALTER TABLE conversation ADD COLUMN topic_id TEXT")
            
        # 检查 topic 表是否存在
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='topic'")
        if not cursor.fetchone():
            print("创建 topic 表")
            cursor.execute('''
                CREATE TABLE topic (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    description TEXT,
                    role TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
        # 检查 role_prompt 表是否存在
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='role_prompt'")
        if not cursor.fetchone():
            print("创建 role_prompt 表")
            cursor.execute('''
                CREATE TABLE role_prompt (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    role_key TEXT UNIQUE NOT NULL,
                    description TEXT,
                    prompt TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ''')
        
        # 检查 settings 表结构
        cursor.execute("PRAGMA table_info(settings)")
        settings_columns = [column[1] for column in cursor.fetchall()]
        
        # 添加缺失的字段
        if 'aliyun_api_key' not in settings_columns:
            cursor.execute("ALTER TABLE settings ADD COLUMN aliyun_api_key TEXT")
        if 'aliyun_model' not in settings_columns:
            cursor.execute("ALTER TABLE settings ADD COLUMN aliyun_model TEXT DEFAULT 'qwen-plus'")
        if 'guiji_api_key' not in settings_columns:
            cursor.execute("ALTER TABLE settings ADD COLUMN guiji_api_key TEXT")
        if 'google_api_key' not in settings_columns:
            cursor.execute("ALTER TABLE settings ADD COLUMN google_api_key TEXT")
        
        # 检查 assistant 表是否存在
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='assistant'")
        if not cursor.fetchone():
            print("创建 assistant 表")
            cursor.execute('''
                CREATE TABLE assistant (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    description TEXT,
                    avatar TEXT,
                    avatar_type TEXT DEFAULT 'emoji',
                    role_key TEXT UNIQUE NOT NULL,
                    is_default BOOLEAN DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
        conn.commit()
        conn.close()
        print("数据库迁移完成")
        
    except Exception as e:
        print(f"数据库迁移失败: {e}")

if __name__ == '__main__':
    migrate_database()