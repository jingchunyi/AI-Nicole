# 技术栈
前端：HTML + Tailwind + Js
后端：Flask + Template ，数据使用 SQLite 保存


## 你需要在服务端提供配置 KEY 的位置，允许用户设置Key、模型名。
默认文本模型：qwen-plus
默认生图模型：wan2.2-t2i-flash

## 默认接入平台提供方（阿里云百炼），你需要再次咨询用户，确认是只接入阿里云百炼或者 OpenRouter

# 通义千问（阿里云百炼）
## 通义千问模型列表：
curl --location 'https://dashscope.aliyuncs.com/compatible-mode/v1/models' \
--header 'Authorization: Bearer <YOUR-DASHSCOPE-API-KEY>' \
--header 'Content-Type: application/json' \

## 通义千问（非流式）：
curl -X POST https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions \
-H "Authorization: Bearer $DASHSCOPE_API_KEY" \
-H "Content-Type: application/json" \
-d '{
    "model": "qwen-plus",
    "messages": [
        {
            "role": "system",
            "content": "You are a helpful assistant."
        },
        {
            "role": "user", 
            "content": "你是谁？"
        }
    ]
}'

## 通义千问（流式）：
curl --location "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions" \
--header "Authorization: Bearer $DASHSCOPE_API_KEY" \
--header "Content-Type: application/json" \
--data '{
    "model": "qwen-plus",
    "messages": [
        {
            "role": "system",
            "content": "You are a helpful assistant."
        },
        {
            "role": "user", 
            "content": "你是谁？"
        }
    ],
    "stream":true
}'

## 通义千问流式返回格式：
data: {"choices":[{"delta":{"content":"","role":"assistant"},"index":0,"logprobs":null,"finish_reason":null}],"object":"chat.completion.chunk","usage":null,"created":1726132850,"system_fingerprint":null,"model":"qwen-max","id":"chatcmpl-428b414f"}
data: {"choices":[{"finish_reason":null,"delta":{"content":"我是"},"index":0,"logprobs":null}],"object":"chat.completion.chunk","usage":null,"created":1726132850,"system_fingerprint":null,"model":"qwen-max","id":"chatcmpl-428b414f"}
data: {"choices":[{"delta":{"content":"来自"},"finish_reason":null,"index":0,"logprobs":null}],"object":"chat.completion.chunk","usage":null,"created":1726132850,"system_fingerprint":null,"model":"qwen-max","id":"chatcmpl-428b414f"}
…
data: {"choices":[],"object":"chat.completion.chunk","usage":{"prompt_tokens":22,"completion_tokens":17,"total_tokens":39},"created":1726132850,"system_fingerprint":null,"model":"qwen-max","id":"chatcmpl-428b414f"}
data: [DONE]


## 通义万象 2.2 获取 ID：
curl -X POST https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis \
    -H 'X-DashScope-Async: enable' \
    -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
    -H 'Content-Type: application/json' \
    -d '{
    "model": "wan2.2-t2i-flash",
    "input": {
        "prompt": "一间有着精致窗户的花店，漂亮的木质门，摆放着花朵"
    },
    "parameters": {
        "size": "1024*1024",
        "n": 1
    }
}'    

###成功：
{
    "output": {
        "task_status": "PENDING",
        "task_id": "0385dc79-5ff8-4d82-bcb6-xxxxxx"
    },
    "request_id": "4909100c-7b5a-9f92-bfe5-xxxxxx"
}


## 通义万象 2.2 获取结果
curl -X GET \
--header "Authorization: Bearer $DASHSCOPE_API_KEY" \
https://dashscope.aliyuncs.com/api/v1/tasks/86ecf553-d340-4e21-xxxxxxxxx


### 成功：
{
    "request_id": "f767d108-7d50-908b-a6d9-xxxxxx",
    "output": {
        "task_id": "d492bffd-10b5-4169-b639-xxxxxx",
        "task_status": "SUCCEEDED",
        "submit_time": "2025-01-08 16:03:59.840",
        "scheduled_time": "2025-01-08 16:03:59.863",
        "end_time": "2025-01-08 16:04:10.660",
        "results": [
            {
                "orig_prompt": "一间有着精致窗户的花店，漂亮的木质门，摆放着花朵",
                "actual_prompt": "一间有着精致雕花窗户的花店，漂亮的深色木质门上挂着铜制把手。店内摆放着各式各样的鲜花，包括玫瑰、百合和向日葵，色彩鲜艳，生机勃勃。背景是温馨的室内场景，透过窗户可以看到街道。高清写实摄影，中景构图。",
                "url": "https://dashscope-result-wlcb.oss-cn-wulanchabu.aliyuncs.com/1.png"
            }
        ],
        "task_metrics": {
            "TOTAL": 1,
            "SUCCEEDED": 1,
            "FAILED": 0
        }
    },
    "usage": {
        "image_count": 1
    }
}

### 失败：
{
    "request_id": "e5d70b02-ebd3-98ce-9fe8-759d7d7b107d",
    "output": {
        "task_id": "86ecf553-d340-4e21-af6e-xxxxxx",
        "task_status": "FAILED",
        "code": "InvalidParameter",
        "message": "xxxxxx",
        "task_metrics": {
            "TOTAL": 4,
            "SUCCEEDED": 0,
            "FAILED": 4
        }
    }
}

# （各类模型）OpenRouter
## 获取模型列表
curl https://openrouter.ai/api/v1/models
### 返回
{
  "data": [
    {
      "id": "string",
      "name": "string",
      "created": 1741818122,
      "description": "string",
      "architecture": {
        "input_modalities": [
          "text",
          "image"
        ],
        "output_modalities": [
          "text"
        ],
        "tokenizer": "GPT",
        "instruct_type": "string"
      },
      "top_provider": {
        "is_moderated": true,
        "context_length": 128000,
        "max_completion_tokens": 16384
      },
      "pricing": {
        "prompt": "0.0000007",
        "completion": "0.0000007",
        "image": "0",
        "request": "0",
        "web_search": "0",
        "internal_reasoning": "0",
        "input_cache_read": "0",
        "input_cache_write": "0"
      },
      "canonical_slug": "string",
      "context_length": 128000,
      "hugging_face_id": "string",
      "per_request_limits": {},
      "supported_parameters": [
        "string"
      ]
    }
  ]
}


## 对话
curl https://openrouter.ai/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -d '{
  "model": "openai/gpt-4o",
  "messages": [
    {
      "role": "user",
      "content": "What is the meaning of life?"
    }
  ]
}'

### 返回（非流式）
{
  "id": "gen-12345",
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "The meaning of life is a complex and subjective question...",
        "refusal": ""
      },
      "logprobs": {},
      "finish_reason": "stop",
      "index": 0
    }
  ],
  "provider": "OpenAI",
  "model": "openai/gpt-3.5-turbo",
  "object": "chat.completion",
  "created": 1735317796,
  "system_fingerprint": {},
  "usage": {
    "prompt_tokens": 14,
    "completion_tokens": 163,
    "total_tokens": 177
  }
}

### 流式
: OPENROUTER PROCESSING
data: {"id":"gen-1754191709","provider":"Alibaba","model":"qwen/qwen3","object":"chat.completion.chunk","created":1754191709,"choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null,"native_finish_reason":null,"logprobs":null}],"system_fingerprint":null}
data: {"id":"gen-1754191709","provider":"Alibaba","model":"qwen/qwen3","object":"chat.completion.chunk","created":1754191709,"choices":[{"index":0,"delta":{"role":"assistant","content":"你好"},"finish_reason":null,"native_finish_reason":null,"logprobs":null}],"system_fingerprint":null}
data: {"id":"gen-1754191709","provider":"Alibaba","model":"qwen/qwen3","object":"chat.completion.chunk","created":1754191709,"choices":[{"index":0,"delta":{"role":"assistant","content":"！"},"finish_reason":null,"native_finish_reason":null,"logprobs":null}],"system_fingerprint":null}
data: {"id":"gen-1754191709","provider":"Alibaba","model":"qwen/qwen3","object":"chat.completion.chunk","created":1754191709,"choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":"stop","native_finish_reason":"stop","logprobs":null}],"system_fingerprint":null}
data: {"id":"gen-1754191709","provider":"Alibaba","model":"qwen/qwen3","object":"chat.completion.chunk","created":1754191709,"choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null,"native_finish_reason":null,"logprobs":null}],"usage":{"prompt_tokens":14,"completion_tokens":2,"total_tokens":16}}
data: [DONE]