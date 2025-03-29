import React, { useState, useEffect } from 'react';

const LOCAL_STORAGE_KEY = 'casinoRewardsFormData';

interface FormData {
  taxRate: string;
  ccReturn: string;
  interestRate: string;
  casinoName: string;
  rewardFrequency: string;
  lastCollectionTime: string;
  expectedReward: string;
  scBalance: string;
  scNeeded: string;
}

interface FormErrors {
  taxRate?: string;
  ccReturn?: string;
  interestRate?: string;
  lastCollectionTime?: string;
  expectedReward?: string;
}

const CasinoRewardsForm = () => {
  const [formData, setFormData] = useState<FormData>(() => {
    const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
    return savedData
      ? JSON.parse(savedData)
      : {
          taxRate: '', ccReturn: '', interestRate: '', casinoName: '',
          rewardFrequency: '24', lastCollectionTime: '', expectedReward: '',
          scBalance: '', scNeeded: '',
        };
  });

  const [timeRemaining, setTimeRemaining] = useState('');
  const [netReward, setNetReward] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(formData));
  }, [formData]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
    if (errors[name as keyof FormErrors]) {
        setErrors(prevErrors => ({ ...prevErrors, [name]: undefined }));
    }
  };

  const validateForm = (): FormErrors => {
      const newErrors: FormErrors = {};
      if (!formData.taxRate || isNaN(Number(formData.taxRate))) {
          newErrors.taxRate = 'Please enter a valid tax rate percentage.';
      }
      if (!formData.ccReturn || isNaN(Number(formData.ccReturn))) {
          newErrors.ccReturn = 'Please enter a valid credit card return percentage.';
      }
      if (!formData.interestRate || isNaN(Number(formData.interestRate))) {
          newErrors.interestRate = 'Please enter a valid interest rate percentage.';
      }
      if (!formData.expectedReward || isNaN(Number(formData.expectedReward)) || Number(formData.expectedReward) <= 0) {
          newErrors.expectedReward = 'Please enter a valid positive reward amount.';
      }
      if (!formData.lastCollectionTime) {
          newErrors.lastCollectionTime = 'Please select the last collection time.';
      } else if (isNaN(new Date(formData.lastCollectionTime).getTime())) {
          newErrors.lastCollectionTime = 'Invalid date/time format.';
      }

      return newErrors;
  }

  const calculateTimeRemaining = (lastCollectionTime: string, rewardFrequency: number): string => {
      const lastCollection = new Date(lastCollectionTime);
      if (isNaN(lastCollection.getTime())) {
        return 'Invalid date entered';
      }
      const nextCollection = new Date(lastCollection.getTime() + rewardFrequency * 60 * 60 * 1000);
      const now = new Date();
      const timeRemainingMs = nextCollection.getTime() - now.getTime();

      if (timeRemainingMs <= 0) {
        return 'Ready to collect!';
      }
      const hours = Math.floor(timeRemainingMs / (1000 * 60 * 60));
      const minutes = Math.floor((timeRemainingMs % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours}h ${minutes}m remaining`;
    };

    const calculateNetReward = (
      expectedRewardStr: string,
      taxRateStr: string,
      ccReturnStr: string,
      interestRateStr: string
    ): number => {
      const expectedReward = Number(expectedRewardStr);
      const taxRate = Number(taxRateStr);
      const ccReturn = Number(ccReturnStr);
      const interestRate = Number(interestRateStr);

      if (isNaN(expectedReward) || isNaN(taxRate) || isNaN(ccReturn) || isNaN(interestRate)) {
        return NaN;
      }

      const taxDeduction = (expectedReward * taxRate) / 100;
      const ccReturnValue = (expectedReward * ccReturn) / 100;
      const interestValue = (expectedReward * interestRate) / 100;
      return expectedReward - taxDeduction + ccReturnValue + interestValue;
    };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTimeRemaining(''); 
    setNetReward('');

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return; 
    }

    setErrors({}); 

    const remaining = calculateTimeRemaining(
        formData.lastCollectionTime,
        Number(formData.rewardFrequency)
    );
    const net = calculateNetReward(
        formData.expectedReward,
        formData.taxRate,
        formData.ccReturn,
        formData.interestRate
    );
    setTimeRemaining(remaining);
    setNetReward(isNaN(net) ? 'Error calculating' : net.toFixed(2));
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6"> 
      <div>
        <label className="block text-sm font-medium text-gray-700">Marginal Tax Rate (%) <span className="text-red-500">*</span></label>
        <input
          type="number"
          name="taxRate"
          value={formData.taxRate}
          onChange={handleInputChange}
          placeholder="e.g., 25" 
          step="any" 
          className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm ${errors.taxRate ? 'border-red-500' : ''}`} 
          aria-describedby={errors.taxRate ? "taxRate-error" : undefined} 
        />
        {errors.taxRate && <p id="taxRate-error" className="mt-1 text-sm text-red-600">{errors.taxRate}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Credit Card Return (%) <span className="text-red-500">*</span></label>
        <input
          type="number"
          name="ccReturn"
          value={formData.ccReturn}
          onChange={handleInputChange}
          placeholder="e.g., 1.5"
          step="any"
          className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm ${errors.ccReturn ? 'border-red-500' : ''}`}
          aria-describedby={errors.ccReturn ? "ccReturn-error" : undefined}
        />
        {errors.ccReturn && <p id="ccReturn-error" className="mt-1 text-sm text-red-600">{errors.ccReturn}</p>}
      </div>

       <div>
        <label className="block text-sm font-medium text-gray-700">Interest Rate (%) <span className="text-red-500">*</span></label>
        <input
          type="number"
          name="interestRate"
          value={formData.interestRate}
          onChange={handleInputChange}
          placeholder="e.g., 0.5"
          step="any"
          className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm ${errors.interestRate ? 'border-red-500' : ''}`}
          aria-describedby={errors.interestRate ? "interestRate-error" : undefined}
        />
        {errors.interestRate && <p id="interestRate-error" className="mt-1 text-sm text-red-600">{errors.interestRate}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Casino Website Name</label>
        <input
          type="text"
          name="casinoName"
          value={formData.casinoName}
          onChange={handleInputChange}
          placeholder="e.g., Chumba Casino"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Reward Collection Frequency (hours) <span className="text-red-500">*</span></label>
        <select
          name="rewardFrequency"
          value={formData.rewardFrequency}
          onChange={handleInputChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
        >
          <option value="3">Every 3 Hours</option>
          <option value="6">Every 6 Hours</option>
          <option value="24">Every 24 Hours</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Last Reward Collection Time <span className="text-red-500">*</span></label>
        <input
          type="datetime-local"
          name="lastCollectionTime"
          value={formData.lastCollectionTime}
          onChange={handleInputChange}
          className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm ${errors.lastCollectionTime ? 'border-red-500' : ''}`}
          aria-describedby={errors.lastCollectionTime ? "lastCollectionTime-error" : undefined}
        />
        {errors.lastCollectionTime && <p id="lastCollectionTime-error" className="mt-1 text-sm text-red-600">{errors.lastCollectionTime}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Expected Reward Amount <span className="text-red-500">*</span></label>
        <input
          type="number"
          name="expectedReward"
          value={formData.expectedReward}
          onChange={handleInputChange}
          placeholder="e.g., 1.00"
          step="any" 
          className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm ${errors.expectedReward ? 'border-red-500' : ''}`}
          aria-describedby={errors.expectedReward ? "expectedReward-error" : undefined}
        />
        {errors.expectedReward && <p id="expectedReward-error" className="mt-1 text-sm text-red-600">{errors.expectedReward}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Sweepstakes Coin (SC) Balance</label>
        <input
          type="number"
          name="scBalance"
          value={formData.scBalance}
          onChange={handleInputChange}
          placeholder="Optional"
          step="any"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">SC Needed to Redeem for Cash</label>
        <input
          type="number"
          name="scNeeded"
          value={formData.scNeeded}
          onChange={handleInputChange}
          placeholder="Optional"
          step="any"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
        />
      </div>

      <button
        type="submit"
        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2" 
      >
        Calculate
      </button>

      {(timeRemaining || netReward) && !Object.keys(errors).length && (
           <div className="md:col-span-2 mt-4 space-y-4"> 
             {timeRemaining && (
                 <div className="p-4 bg-green-100 rounded-md">
                   <p className="text-green-700 font-medium">Time Remaining: <span className="font-normal">{timeRemaining}</span></p>
                 </div>
             )}
             {netReward && (
                 <div className="p-4 bg-blue-100 rounded-md">
                   <p className="text-blue-700 font-medium">Net Reward: <span className="font-normal">{netReward.startsWith('Error') ? netReward : `$${netReward}`}</span></p>
                 </div>
             )}
            </div>
       )}
    </form>
  );
};

export default CasinoRewardsForm;
