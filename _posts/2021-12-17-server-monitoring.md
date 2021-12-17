---
published: true
layout: post
background: /img/posts/06.jpg
comments: true
title: 연구실 서버 여러 대 상태 웹사이트로 한번에 보기
---
# 모티

작업하다가 서버 상태 맨날 들어가서 보는게 힘들어서, 여러 개의 서버 상태를 한번에 모니터링하고싶었다.
그러다가 좋은 레포를 받아서 써봤는데 만족스러워서 공유.




[GitHub - djosix/servstat: Server resource and GPU process monitor.](https://github.com/djosix/servstat)

이거 사용해서 만듬

# 순서

### 0. 서버 만들기 (정보를 보내는 놈)

### 1. 중개서버 만들기 (서버에서 정보 받아서 웹에 뿌리는 놈)

### 2. 웹사이트로 내 컴피터에서 서버 상태들 보기

# 0. 서버 만들기

위에 있는 servstat을 받아서 ‘backend’부분을 만들면 됨

단, 루트 계정에서 실시해야 함

원하는 서버마다 설치해서 켜놓으면 됨

설치

```bash
cd /root
git clone https://github.com/djosix/servstat.git .servstat
cd .servstat/backend

python3 -m pip install -r requirements.txt
```

실행

```bash
python3 main.py --host=SERVER_IP --port=PORT
```

# 1. 중개서버 만들기

중개서버 역할을 할 애 하나 정해서 하면 됨

nodejs v17에서 잘 동작함 (github엔 14라고 되어있는데 17에서 됨)

설치

```bash
git clone https://github.com/djosix/servstat.git
cd servstat/frontend

npm install
npm install http-server -g

```

실행

```bash
vi public/config.json # 여기서 받을 서버들 IP 설정하면 됨. 여러 개 가능

npm run build

npx http-server
```

# 2. 웹사이트로 확인하기

중개 서버 ip랑 포트 입력(기본 8080일거임)

<img width="1497" alt="image" src="https://user-images.githubusercontent.com/7467605/146536309-0caa98e0-d4dc-42cc-8e7e-d6542257a5b7.png">

삽가능
