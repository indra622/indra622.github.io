---
published: true
layout: post
title: Warm-up 방식
---
## Warm-up 방식

음성인식이랑 audio scene classification을 conformer를 통해서 학습시켜보고 싶어서 구현해 보았다.

별 문제 없이 잘 동작했는데 문제는 일정 loss 이하로 떨어지지 않았다.

애초에 적은 데이터로도 학습하는 것이 목적이라서 예상했던 일이긴 하지만, 다른 사람이 구현한 건 잘 돌아갔었기 때문에 원인을 찾아보기로 했다.

그래서 찾아보니까 optimizer를 그냥 adam optimizer를 사용했었는데, scheduler가 중요한 거였다.

(대충 요약하자면 optimizer는 DNN을 학습하는 알고리즘을 말하고, scheduler는 optimizer가 learning rate를 어떻게 조정하면서 학습을 하는지를 제시하는 역할을 한다.)

그래서 다른 사람들은 conformer 구현할 때 scheduler를 뭘 쓰나 보니까 warm-up이라는 걸 사용했다.

얘는 설명하자면, learning rate를 처음에 높게 잡고 서서히 낮추는 기존의 scheduler와 다르게 처음에는 낮은 rate로 시작해서 hyperparameter인 warm-up step까지 서서히 linear하게 증가시키고, warm-up step을 넘기면 그 다음부터는 일반적인 adam optimizer를 사용하는 방식이었다. attention is all you need 논문에도 나와 있는 것을 확인함.

지금 학습 초반인데 결과가 어떻게 나올지 기대됨

구체적인 수식과 설명은 진짜 간단해서 금방 알 수 있는데, 추후에 정리해볼 수 있으면 정리해야징
