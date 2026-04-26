import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowRight, Loader2, Activity } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'https://firecheck-api.vercel.app';

export default function QuizFunnel() {
  const navigate = useNavigate();
  const [step, setStep] = useState(-1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [sessionId] = useState(() => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));
  const [answers, setAnswers] = useState({ q1: null, q2: null, q3: null, q4: null });

  const trackStep = async (currentStep, updatedAnswers = answers, completed = false) => {
    try {
      await fetch(`${API_URL}/api/track-quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, step: currentStep, ...updatedAnswers, completed })
      });
    } catch (e) {}
  };

  useEffect(() => {
    if (step === -1 || step === 0) {
      trackStep(step);
    }
  }, [step]);
  
  const questions = [
    {
      title: "Qual é o seu ramo de atuação?",
      options: [
        "Alimentação (Restaurantes, Lanchonetes)", 
        "Varejo (Lojas, Mercados)", 
        "Hotelaria (Hotéis, Pousadas)",
        "Academias e Esportes",
        "Serviços / Clínicas", 
        "Outro"
      ]
    },
    {
      title: "Como você controla as tarefas diárias da sua equipe hoje?",
      options: [
        "Boca a boca (Peço e eles dizem que fizeram)", 
        "Papel e prancheta na parede", 
        "Mandam fotos no WhatsApp (Vira uma bagunça)", 
        "App de Checklist comum (Temos que verificar um por um)"
      ]
    },
    {
      title: "Com que frequência você descobre que uma tarefa 'feita' foi mal feita ou esquecida?",
      options: ["Raramente", "1 a 3 vezes na semana", "Todo santo dia (Tô cansado disso)"]
    },
    {
      title: "Se você ficasse 15 dias sem ir na sua empresa hoje, o que aconteceria?",
      options: [
        "Rodaria 100% perfeito sem mim.", 
        "Teriam algumas falhas, mas sobreviveria.", 
        "Viraria um caos completo e eu perderia dinheiro."
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
      <div style={{ backgroundColor: '#f8fafc', color: '#0f172a', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center' }}>
        <Loader2 size={60} color="#22c55e" style={{ animation: 'spin 1s linear infinite', marginBottom: '24px' }} />
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{loadingText}</h2>
        <p style={{ color: '#64748b', marginTop: '16px', maxWidth: '400px' }}>Nossa Inteligência Artificial está processando suas respostas para encontrar o real prejuízo oculto na sua operação.</p>
      </div>
    );
  }

  if (step === 100) {
    return (
      <div style={{ backgroundColor: '#f8fafc', color: '#0f172a', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ maxWidth: '600px', width: '100%', backgroundColor: '#ffffff', padding: '40px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 40px rgba(0,0,0,0.05)', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(255, 59, 48, 0.1)', color: '#ef4444', padding: '8px 16px', borderRadius: '20px', fontWeight: 'bold', marginBottom: '24px' }}>
            <ShieldAlert size={20} /> ALERTA DE RISCO
          </div>
          
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '16px', lineHeight: '1.2' }}>Risco Operacional: <span style={{ color: '#ef4444' }}>MUITO ALTO</span></h1>
          
          <div style={{ backgroundColor: 'rgba(255, 59, 48, 0.05)', borderLeft: '4px solid #ef4444', padding: '20px', textAlign: 'left', marginBottom: '32px', borderRadius: '0 8px 8px 0' }}>
            <p style={{ marginBottom: '12px', fontSize: '1.1rem' }}><strong>O Diagnóstico:</strong> Você está preso na microgestão. Sem você vigiando de perto, o padrão da sua loja cai drasticamente.</p>
            <p style={{ color: '#64748b' }}>Você passa mais tempo cobrando tarefas básicas (limpeza, validade, organização) do que pensando em como crescer sua empresa. O pior: seus funcionários sabem disso e entregam o mínimo.</p>
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
            style={{ width: '100%', padding: '20px', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', backgroundColor: '#16a34a', color: 'white', borderRadius: '12px', fontWeight: 'bold', border: 'none', cursor: 'pointer', transition: 'all 0.3s ease' }} 
            onClick={() => navigate('/')}
          >
            Ver a Inteligência Artificial na Prática <ArrowRight />
          </button>
          <p style={{ marginTop: '16px', color: '#64748b', fontSize: '0.9rem' }}>Chega de ser babá de funcionário. Assuma o controle hoje.</p>
        </div>
      </div>
    );
  }

  if (step === -1) {
    return (
      <div style={{ backgroundColor: '#f8fafc', color: '#0f172a', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ maxWidth: '600px', width: '100%', backgroundColor: '#ffffff', padding: '50px 40px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 40px rgba(0,0,0,0.05)', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#16a34a', padding: '8px 16px', borderRadius: '20px', fontWeight: 'bold', marginBottom: '24px' }}>
            <Activity size={20} /> DIAGNÓSTICO DE ROTINA
          </div>
          
          <h1 style={{ fontSize: '2.2rem', fontWeight: 'bold', marginBottom: '16px', lineHeight: '1.2', color: '#1e293b' }}>
            A sua equipe realmente faz o que precisa ser feito do jeito <span style={{ color: '#ef4444' }}>certo</span>?
          </h1>
          
          <p style={{ fontSize: '1.1rem', color: '#64748b', marginBottom: '32px', lineHeight: '1.6' }}>
            O maior erro do dono de negócio é confiar apenas no boca a boca do <i>"chefe, já fiz"</i>. Responda a 4 perguntas rápidas e descubra se as rotinas da sua empresa estão sendo realmente executadas quando você não está olhando.
          </p>

          <button 
            className="btn-pulse-green"
            style={{ width: '100%', padding: '20px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', backgroundColor: '#16a34a', color: 'white', borderRadius: '12px', fontWeight: 'bold', border: 'none', cursor: 'pointer', transition: 'all 0.3s ease' }} 
            onClick={() => setStep(0)}
          >
            Iniciar Diagnóstico Agora <ArrowRight />
          </button>
          <p style={{ marginTop: '16px', color: '#94a3b8', fontSize: '0.85rem' }}>Análise 100% gratuita e sem compromisso.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#f8fafc', color: '#0f172a', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      
      <div style={{ width: '100%', maxWidth: '600px', marginBottom: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#64748b', fontSize: '0.9rem', fontWeight: 'bold' }}>
          <span>Diagnóstico Operacional</span>
          <span>Pergunta {step + 1} de {questions.length}</span>
        </div>
        <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
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
                backgroundColor: '#f8fafc', border: '2px solid #e2e8f0', color: '#1e293b',
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
