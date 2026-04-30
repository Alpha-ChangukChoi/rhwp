// 모든 e2e 테스트 시작 전 기본 환경변수 설정
// 키 누락 시 부팅 실패 시나리오는 각 테스트가 명시적으로 delete 한 후 검증
process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY ??= 'sk-test';
