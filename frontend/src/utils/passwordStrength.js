export function getPasswordRequirements(password = '') {
  return {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}

export function getPasswordRequirementScore(requirements) {
  return Object.values(requirements).filter(Boolean).length;
}

export function meetsAllPasswordRequirements(requirements) {
  return Object.values(requirements).every(Boolean);
}

export function getRegisterPasswordStrength(password, requirements = getPasswordRequirements(password)) {
  const score = getPasswordRequirementScore(requirements);

  if (!password) return { text: 'Weak', barWidth: '20%', colorClass: 'bg-[#ba1a1a] text-[#ba1a1a]' };
  if (score <= 2) return { text: 'Weak', barWidth: '33%', colorClass: 'bg-[#ba1a1a] text-[#ba1a1a]' };
  if (score <= 4) return { text: 'Medium', barWidth: '66%', colorClass: 'bg-[#943700] text-[#943700]' };
  return { text: 'Strong', barWidth: '100%', colorClass: 'bg-[#004ac6] text-[#004ac6]' };
}

export function getResetPasswordStrength(password, requirements = getPasswordRequirements(password)) {
  const score = getPasswordRequirementScore(requirements);

  if (password.length === 0) {
    return { label: 'Strength: None', width: '0%', colorClass: 'bg-slate-200' };
  }
  if (score < 3) {
    return { label: 'Strength: Weak', width: '33%', colorClass: 'bg-red-500' };
  }
  if (score < 5) {
    return { label: 'Strength: Medium', width: '66%', colorClass: 'bg-amber-400' };
  }
  return { label: 'Strength: Strong', width: '100%', colorClass: 'bg-emerald-500' };
}

export function getProfilePasswordStrength(password, requirements = getPasswordRequirements(password)) {
  const percentage = getPasswordRequirementScore(requirements) * 20;

  if (!password) return { percentage, text: 'None', colorClass: 'bg-red-500' };
  if (percentage <= 20) return { percentage, text: 'Weak', colorClass: 'bg-red-500' };
  if (percentage <= 40) return { percentage, text: 'Fair', colorClass: 'bg-orange-500' };
  if (percentage <= 60) return { percentage, text: 'Good', colorClass: 'bg-yellow-500' };
  if (percentage <= 80) return { percentage, text: 'Strong', colorClass: 'bg-blue-500' };
  return { percentage, text: 'Very Strong', colorClass: 'bg-green-500' };
}
