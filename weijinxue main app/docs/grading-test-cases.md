# Yǔbàn Grading Test Cases

Run each case in the app with dev mode on (`localStorage.setItem('yuban_dev_mode', 'true')` then reload).
Check the parsed JSON and **Normalized grading (app)** in the inspector.

## Yes/No questions

### 1. Single-character affirmative
- NPC: 华金，吃饭吗?
- Student types: 吃
- Expect: `verdict=correct`, `taskCompleted=true`, `detectedIntent=affirmative`

### 2. Full-sentence affirmative
- Student: 是的，我要吃饭
- Expect: `verdict=correct`

### 3. Implicit affirmative
- Student: 我饿了
- Expect: `verdict=correct` or `almost`, `detectedIntent=affirmative`, not marked fully wrong

### 4. Soft yes / delay
- Student: 等一下
- Expect: `almost`, `detectedIntent` maybe/wait

### 5. Typo recovery
- Student: 堆
- Expect: `almost`, `likelyTypo=true`, `likelyIntended=对`, recovery button offered

## Greetings

### 6. Simple greeting reply
- NPC: 欢迎光临
- Student: 谢谢
- Expect: `correct`, `taskCompleted=true`

### 7. Off-task long reply (HSK 1)
- Student: 谢谢！我很高兴在里中国！你知道我可以吃饭东西好吃吗？
- Expect: `off_task` or `almost`
- 老师 correction must be HSK 1 simple (e.g. 谢谢！ or 你好！)
- Advanced phrasing should be in 朋友 voice, labeled `above_current_level`

## Either/or choices

### 8. Single-word choice
- NPC: 你想喝茶还是水?
- Student: 茶
- Expect: `correct`

### 9. Full-sentence choice
- Student: 我想喝茶
- Expect: `correct`

### 10. Uncertainty
- Student: 不知道
- Expect: `correct` or `almost`, `detectedIntent` uncertainty
