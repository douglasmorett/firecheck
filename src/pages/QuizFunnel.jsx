import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowRight, Loader2, Activity, Play, Gift, VolumeX } from 'lucide-react';

import API_URL from '../api';

export default function QuizFunnel() {
  const navigate = useNavigate();
  const [step, setStep] = useState(-1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [sessionId] = useState(() => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));
  const [answers, setAnswers] = useState({ q1: null, q2: null, q3: null, q4: null });
  const [showOffer, setShowOffer] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef(null);

  const trackStep = useCallback(async (currentStep, updatedAnswers = answers, forceCompleted = false, clickedCta = false) => {
    const isCompleted = forceCompleted || currentStep === 100;
    try {
      await fetch(`${API_URL}/api/track-quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, step: currentStep, ...updatedAnswers, completed: isCompleted, clickedCta })
      });
    } catch {
      // ignore error silently
    }
  }, [sessionId, answers]);

  useEffect(() => {
    trackStep(step);
    
    // Mantém a sessão ativa no painel Master pingando a cada 30 segundos
    const interval = setInterval(() => {
      trackStep(step);
    }, 30000);
    
    return () => clearInterval(interval);
  }, [step, trackStep]);
  
  const questions = [
    {
      title: "Você sente que precisa estar fisicamente na sua empresa para que as coisas sejam feitas do jeito certo?",
      options: [
        "Sim, se eu virar as costas, o padrão cai na hora.", 
        "Às vezes. A equipe até tenta, mas sempre esquece detalhes.", 
        "Não, a operação roda 100% perfeita sem mim."
      ]
    },
    {
      title: "Como você costuma descobrir que uma tarefa (limpeza, organização, validade) foi mal feita?",
      options: [
        "Só quando eu chego na empresa e vejo o erro com meus próprios olhos.", 
        "Quando um cliente reclama do serviço/ambiente.", 
        "Eles me mandam foto, mas dá um trabalho enorme conferir uma por uma."
      ]
    },
    {
      title: "O que mais te irrita no dia a dia com os funcionários?",
      options: [
        "Ter que repetir as mesmas ordens todo santo dia.", 
        "A desculpa do 'esqueci, chefe' para tarefas básicas.", 
        "A sensação de que estou pagando para eu mesmo ter que gerenciar tudo."
      ]
    },
    {
      title: "Para podermos gerar seu diagnóstico, qual é o seu ramo de atuação?",
      options: [
        "Alimentação (Restaurantes, Lanchonetes)", 
        "Varejo (Lojas, Mercados)", 
        "Hotelaria e Academias",
        "Serviços / Clínicas", 
        "Outro"
      ]
    }
  ];

  const handleAnswer = (index) => {
    const questionKeys = ['q1', 'q2', 'q3', 'q4'];
    const currentKey = questionKeys[step];
    const answerText = questions[step].options[index];
    
    const newAnswers = { ...answers, [currentKey]: answerText };
    setAnswers(newAnswers);

    if (step < questions.length - 1) {
      setStep(step + 1);
      trackStep(step + 1, newAnswers, false);
    } else {
      trackStep(step + 1, newAnswers, true);
      startProcessing();
    }
  };

  const startProcessing = () => {
    setIsProcessing(true);
    const messages = [
      "Analisando seu modelo operacional...",
      "Identificando vazamentos financeiros...",
      "Calculando risco de falhas da equipe...",
      "Gerando diagnóstico final..."
    ];
    let i = 0;
    setLoadingText(messages[0]);
    const interval = setInterval(() => {
      i++;
      if (i < messages.length) {
        setLoadingText(messages[i]);
      } else {
        clearInterval(interval);
        setIsProcessing(false);
        setStep(100); // Result page
      }
    }, 1500);
  };

  if (isProcessing) {
    return (
      <div style={{ backgroundColor: 'var(--text-main)', color: '#0f172a', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center' }}>
        <Loader2 size={60} color="#22c55e" style={{ animation: 'spin 1s linear infinite', marginBottom: '24px' }} />
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{loadingText}</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '16px', maxWidth: '400px' }}>Nossa Inteligência Artificial está processando suas respostas para encontrar o real prejuízo oculto na sua operação.</p>
      </div>
    );
  }

  if (step === 100) {
    return (
      <div style={{ backgroundColor: 'var(--text-main)', color: '#0f172a', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ maxWidth: '600px', width: '100%', backgroundColor: '#ffffff', padding: '40px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 40px rgba(0,0,0,0.05)', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(255, 59, 48, 0.1)', color: '#ef4444', padding: '8px 16px', borderRadius: '20px', fontWeight: 'bold', marginBottom: '24px' }}>
            <ShieldAlert size={20} /> ALERTA DE RISCO
          </div>
          
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '16px', lineHeight: '1.2' }}>Risco Operacional: <span style={{ color: '#ef4444' }}>MUITO ALTO</span></h1>
          
          <div style={{ backgroundColor: 'rgba(255, 59, 48, 0.05)', borderLeft: '4px solid #ef4444', padding: '20px', textAlign: 'left', marginBottom: '32px', borderRadius: '0 8px 8px 0' }}>
            <p style={{ marginBottom: '12px', fontSize: '1.1rem' }}><strong>O Diagnóstico:</strong> Você está preso na microgestão. Sem você vigiando de perto, o padrão da sua loja cai drasticamente.</p>
            <p style={{ color: 'var(--text-muted)' }}>Você passa mais tempo cobrando tarefas básicas (limpeza, validade, organização) do que pensando em como crescer sua empresa. O pior: seus funcionários sabem disso e entregam o mínimo.</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '16px', fontWeight: 'bold' }}>A Solução Definitiva:</h3>
            <img src="/icon-192.png" alt="FireCheck Logo" style={{ width: '80px', height: '80px', borderRadius: '20px', boxShadow: '0 8px 16px rgba(255,77,0,0.3)', marginBottom: '8px' }} />
            <span style={{ fontSize: '1.2rem', fontWeight: 'bold', letterSpacing: '-0.5px' }}>FireCheck</span>
          </div>
          <p style={{ marginBottom: '32px', color: '#334155', lineHeight: '1.6', textAlign: 'justify' }}>
            A única forma de escalar sem perder a sanidade é ter um sistema que cobre a equipe por você.<br/><br/>
            Com o <strong>FireCheck</strong>, o seu funcionário é OBRIGADO a tirar uma foto provando que limpou o chão. A nossa <strong>Inteligência Artificial</strong> audita a foto em 2 segundos. Se estiver mal feito, a IA rejeita e manda ele refazer na hora. Você não precisa nem levantar da cadeira, só recebe a notificação de que está 100% perfeito.
          </p>

          <button 
            className="btn-pulse-green"
            style={{ width: '100%', padding: '20px', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', backgroundColor: '#16a34a', color: 'var(--text-main)', borderRadius: '12px', fontWeight: 'bold', border: 'none', cursor: 'pointer', transition: 'all 0.3s ease' }} 
            onClick={() => {
              trackStep(100, answers, true, true);
              navigate('/');
            }}
          >
            Ver a Inteligência Artificial na Prática <ArrowRight />
          </button>
          <p style={{ marginTop: '16px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Chega de ser babá de funcionário. Assuma o controle hoje.</p>
        </div>
      </div>
    );
  }

  if (step === -1) {
    return (
      <div style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ maxWidth: '700px', width: '100%', textAlign: 'center' }}>
          
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '16px', lineHeight: '1.2', color: '#ffffff' }}>
            A sua equipe só funciona de verdade quando <span style={{ color: '#ef4444' }}>você está lá?</span>
          </h1>
          <p style={{ fontSize: '1.1rem', color: '#94a3b8', marginBottom: '24px' }}>
            Assista ao vídeo abaixo e descubra como auditar sua operação no piloto automático.
          </p>

          <div style={{ width: '100%', borderRadius: '16px', overflow: 'hidden', marginBottom: '24px', border: '1px solid var(--border-color)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', position: 'relative', backgroundColor: 'var(--bg-color)' }}>
            {!isPlaying && (
              <div 
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', zIndex: 10, cursor: 'pointer' }}
                onClick={() => {
                  setIsPlaying(true);
                  if (videoRef.current) {
                    videoRef.current.muted = false;
                    videoRef.current.currentTime = 0;
                    videoRef.current.play();
                  }
                  if (!sessionStorage.getItem('quiz_video_played')) {
                    fetch(`${API_URL}/api/track-quiz-video`, { method: 'POST' }).catch(() => {});
                    sessionStorage.setItem('quiz_video_played', 'true');
                  }
                }}
              >
                <div style={{ backgroundColor: '#ef4444', color: 'var(--text-main)', padding: '24px 40px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', boxShadow: '0 10px 30px rgba(239, 68, 68, 0.6)', animation: 'pulse 1.5s infinite', border: '3px solid white', textAlign: 'center' }}>
                  <span style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>Clique aqui</span>
                  <VolumeX size={50} />
                  <span style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>para ativar o som</span>
                </div>
              </div>
            )}
            <video 
              ref={videoRef}
              src="/IMG_0931.MOV" 
              style={{ width: '100%', display: 'block', maxHeight: '60vh', opacity: isPlaying ? 1 : 0.8, cursor: isPlaying ? 'pointer' : 'default' }}
              controls={false}
              autoPlay={!isPlaying}
              muted={!isPlaying}
              loop={!isPlaying}
              playsInline
              controlsList="nodownload noremoteplayback"
              disablePictureInPicture
              onClick={() => {
                if (isPlaying && videoRef.current) {
                  if (videoRef.current.paused) {
                    videoRef.current.play();
                  } else {
                    videoRef.current.pause();
                  }
                }
              }}
              onTimeUpdate={(e) => {
                // Oferta configurada para revelar exatos aos 29 segundos
                if (e.target.currentTime >= 29 && !showOffer) {
                  setShowOffer(true);
                }
              }}
            />
          </div>
          
          {/* Botão sempre visível, mas muda de cor e texto quando a oferta é revelada */}
          <div style={{ transition: 'all 0.5s ease', transform: showOffer ? 'scale(1.05)' : 'scale(1)' }}>
            {showOffer && (
              <div style={{ color: '#22c55e', fontWeight: 'bold', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', animation: 'pulse 1s infinite alternate' }}>
                <Gift size={20} /> 7 DIAS TOTALMENTE GRÁTIS LIBERADOS!
              </div>
            )}
            <button 
              className={showOffer ? "btn-pulse-green" : ""}
              style={{ 
                width: '100%', padding: '20px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', 
                backgroundColor: showOffer ? '#16a34a' : 'rgba(255,255,255,0.05)', 
                color: showOffer ? 'white' : '#94a3b8', 
                borderRadius: '12px', fontWeight: 'bold', 
                border: showOffer ? 'none' : '1px solid rgba(255,255,255,0.1)', 
                cursor: 'pointer', transition: 'all 0.3s ease' 
              }} 
              onClick={() => setStep(0)}
            >
              {showOffer ? "Fazer Diagnóstico e Resgatar Meus 7 Dias" : "Fazer meu diagnóstico rápido"} <ArrowRight />
            </button>
            <p style={{ marginTop: '16px', color: '#475569', fontSize: '0.85rem' }}>Leva menos de 30 segundos.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: 'var(--text-main)', color: '#0f172a', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      
      <div style={{ width: '100%', maxWidth: '600px', marginBottom: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 'bold' }}>
          <span>Diagnóstico Operacional</span>
          <span>Pergunta {step + 1} de {questions.length}</span>
        </div>
        <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--text-main)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ height: '100%', backgroundColor: '#22c55e', width: `${((step) / questions.length) * 100}%`, transition: 'width 0.5s ease' }}></div>
        </div>
      </div>

      <div style={{ maxWidth: '600px', width: '100%', backgroundColor: '#ffffff', padding: '40px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 40px rgba(0,0,0,0.05)' }}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '32px', lineHeight: '1.3' }}>
          {questions[step].title}
        </h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {questions[step].options.map((opt, idx) => (
            <button 
              key={idx}
              onClick={() => handleAnswer(idx)}
              style={{
                backgroundColor: 'var(--text-main)', border: '2px solid #e2e8f0', color: '#1e293b',
                padding: '20px', borderRadius: '12px', fontSize: '1.1rem', textAlign: 'left',
                cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: '500'
              }}
              onMouseOver={(e) => { e.currentTarget.style.borderColor = '#22c55e'; e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.05)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseOut={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: '2px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}></div>
              {opt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
