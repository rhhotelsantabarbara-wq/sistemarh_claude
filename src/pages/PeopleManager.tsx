import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Users, Network, TrendingUp, Briefcase, Calendar, Heart, FileCheck } from "lucide-react";
import PeopleDashboard from "@/components/people-manager/PeopleDashboard";
import Organograma from "@/components/people-manager/Organograma";
import TalentAnalytics from "@/components/people-manager/TalentAnalytics";
import CareerManagement from "@/components/people-manager/CareerManagement";
import WorkforcePlanning from "@/components/people-manager/WorkforcePlanning";
import EmployeeEngagement from "@/components/people-manager/EmployeeEngagement";
import ComplianceDocuments from "@/components/people-manager/ComplianceDocuments";

export default function PeopleManager() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div className="">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-xl font-medium leading-tight">People Manager</h1>
            <p className="text-muted-foreground">Gestão estratégica de pessoas e talentos</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="inline-flex w-full overflow-x-auto tabs-scroll h-auto">
            <TabsTrigger value="dashboard" className="flex-shrink-0 flex flex-col gap-1 py-3">
              <Users className="h-4 w-4" />
              <span className="text-xs hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="organograma" className="flex-shrink-0 flex flex-col gap-1 py-3">
              <Network className="h-4 w-4" />
              <span className="text-xs hidden sm:inline">Organograma</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex-shrink-0 flex flex-col gap-1 py-3">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="carreira" className="flex-shrink-0 flex flex-col gap-1 py-3">
              <Briefcase className="h-4 w-4" />
              <span className="text-xs hidden sm:inline">Carreira</span>
            </TabsTrigger>
            <TabsTrigger value="workforce" className="flex-shrink-0 flex flex-col gap-1 py-3">
              <Calendar className="h-4 w-4" />
              <span className="text-xs hidden sm:inline">Workforce</span>
            </TabsTrigger>
            <TabsTrigger value="engagement" className="flex-shrink-0 flex flex-col gap-1 py-3">
              <Heart className="h-4 w-4" />
              <span className="text-xs hidden sm:inline">Engajamento</span>
            </TabsTrigger>
            <TabsTrigger value="compliance" className="flex-shrink-0 flex flex-col gap-1 py-3">
              <FileCheck className="h-4 w-4" />
              <span className="text-xs hidden sm:inline">Compliance</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <PeopleDashboard />
          </TabsContent>

          <TabsContent value="organograma" className="mt-6">
            <Organograma />
          </TabsContent>

          <TabsContent value="analytics" className="mt-6">
            <TalentAnalytics />
          </TabsContent>

          <TabsContent value="carreira" className="mt-6">
            <CareerManagement />
          </TabsContent>

          <TabsContent value="workforce" className="mt-6">
            <WorkforcePlanning />
          </TabsContent>

          <TabsContent value="engagement" className="mt-6">
            <EmployeeEngagement />
          </TabsContent>

          <TabsContent value="compliance" className="mt-6">
            <ComplianceDocuments />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
