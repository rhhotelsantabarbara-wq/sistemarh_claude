import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import CompanyList from "@/components/companies/CompanyList";

export default function Companies() {
  const navigate = useNavigate();

  return (
    <div className="">
      <div className="max-w-7xl mx-auto">

        <CompanyList />
      </div>
    </div>
  );
}
