import { useState } from 'react';
import './App.css';
import Step0_Input from './components/Step0_Input';
import { Step1_Experts } from './components/Step1_Experts';
import { Step2_Hearing } from './components/Step2_Hearing';
import { Step3_Visualize } from './components/Step3_Visualize';
import { Step5_Evaluation } from './components/Step5_Evaluation';
import { Step7_Action } from './components/Step7_Action';

function App() {
  const [step, setStep] = useState<number>(0);
  const [subName, setSubName] = useState<string>('');
  const [price, setPrice] = useState<number | null>(null);

  // 後続ステップで使う状態群
  const [frequency, setFrequency] = useState<number | null>(null);
  const [reason, setReason] = useState<number[]>([]);
  const [satisfaction, setSatisfaction] = useState<number | null>(null);

  // To avoid unused variable warning, we can log them or just ignore them since it's a mock
  console.log(reason, satisfaction);

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <Step0_Input
            subName={subName}
            setSubName={setSubName}
            price={price}
            setPrice={setPrice}
            onNext={() => setStep(1)}
          />
        );
      case 1:
        return <Step1_Experts subName={subName} onNext={() => setStep(2)} />;
      case 2:
        return (
          <Step2_Hearing
            subName={subName}
            setFrequency={setFrequency}
            setReason={setReason}
            onNext={() => setStep(3)}
          />
        );
      case 3:
      case 4:
        return <Step3_Visualize subName={subName} frequency={frequency} onNext={() => setStep(5)} />;
      case 5:
      case 6:
        return (
          <Step5_Evaluation
            subName={subName}
            wasteAmount={(price || 1500) * (100 - (frequency === 1 ? 100 : frequency === 2 ? 70 : frequency === 3 ? 30 : frequency === 4 ? 5 : 0)) / 100}
            setSatisfaction={setSatisfaction}
            onNext={() => setStep(7)}
            onReset={() => {
              setStep(0);
              setSubName('');
              setPrice(null);
              setFrequency(null);
              setReason([]);
              setSatisfaction(null);
            }}
          />
        );
      case 7:
        return <Step7_Action subName={subName} onReset={() => {
          setStep(0);
          setSubName('');
          setPrice(null);
          setFrequency(null);
          setReason([]);
          setSatisfaction(null);
        }} />;
      default:
        return <div>Unknown Step</div>;
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="header-title animate-pulse-glow">
          <span className="text-accent-gradient">サブスク断捨離</span>の守護神
        </h1>
        <p className="header-subtitle">あなたの家計を守る、冷徹なる看守</p>
      </header>

      <main className="main-content">
        {renderStep()}
      </main>

      <footer className="app-footer">
        <p>© 2026 Subscription Guardian System</p>
      </footer>
    </div>
  );
}

export default App;
