export function examImageSrc(examId, file) {
  const match = String(file).match(/H\d+_(listening|reading)_part(\d)_/)
  const folder = match ? `${match[1]}_part${match[2]}` : ''
  return folder ? `/exams/${examId}/images/${folder}/${file}` : `/exams/${examId}/images/${file}`
}
