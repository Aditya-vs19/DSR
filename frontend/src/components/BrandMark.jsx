import logo from "../assets/logo.png";
import wordmark from "../assets/cludosi360-wordmark.png";

const BrandMark = ({ className = "", logoClassName = "h-14 w-auto", wordmarkClassName = "h-12 w-auto" }) => {
  return (
    <div className={`flex shrink-0 items-center gap-5 ${className}`}>
      <img src={logo} alt="CludoBits" className={`${logoClassName} object-contain object-left`} />
      <span className="h-16 w-px shrink-0 bg-slate-600/80" aria-hidden="true" />
      <img src={wordmark} alt="CludoSI 360" className={`${wordmarkClassName} translate-y-2 object-contain object-left`} />
    </div>
  );
};

export default BrandMark;
