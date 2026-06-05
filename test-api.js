// 测试 DeepSeek API 是否正常工作
const API_URL = 'https://api.deepseek.com/chat/completions'

async function testAPI(apiKey) {
  console.log('测试 DeepSeek API...')
  console.log('API Key:', apiKey ? `${apiKey.substring(0, 10)}...` : '未配置')

  if (!apiKey) {
    console.log('❌ 未配置 API Key')
    return
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'user', content: '你好，请回复OK' }
        ],
        max_tokens: 10,
      }),
    })

    if (!response.ok) {
      console.log('❌ API 响应错误:', response.status)
      return
    }

    const data = await response.json()
    console.log('✅ API 调用成功!')
    console.log('回复:', data.choices?.[0]?.message?.content)
  } catch (error) {
    console.log('❌ API 调用失败:', error.message)
  }
}

// 从命令行参数获取 API Key
const apiKey = process.argv[2]
testAPI(apiKey)
