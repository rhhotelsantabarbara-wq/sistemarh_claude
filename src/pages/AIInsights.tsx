import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Bot, Target, Award, FileText, Brain, Sparkles } from "lucide-react";
import { AIAssistant } from "@/components/ai/AIAssistant";
import { TurnoverPrediction } from "@/components/ai/TurnoverPrediction";
import { PromotionSuggestions } from "@/components/ai/PromotionSuggestions";
import { AIReportGenerator } from "@/components/ai/AIReportGenerator";
import { SentimentAnalysis } from "@/components/ai/SentimentAnalysis";

const AIInsights = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-6 px-4">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Dashboard
          </Button>

          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Bot className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                Inteligência Artificial
                <Sparkles className="h-5 w-5 text-yellow-500" />
              </h1>
              <p className="text-muted-foreground">
                Análises preditivas e assistência inteligente para gestão de RH
              </p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="assistant" className="space-y-6">
          <TabsList className="inline-flex w-full overflow-x-auto tabs-scroll">
            <TabsTrigger value="assistant" className="flex-shrink-0 flex items-center gap-2">
              <Bot className="h-4 w-4" />
              <span className="hidden sm:inline">Assistente</span>
            </TabsTrigger>
            <TabsTrigger value="turnover" className="flex-shrink-0 flex items-center gap-2">
              <Target className="h-4 w-4" />
              <span className="hidden sm:inline">Turnover</span>
            </TabsTrigger>
            <TabsTrigger value="promotion" className="flex-shrink-0 flex items-center gap-2">
              <Award className="h-4 w-4" />
              <span className="hidden sm:inline">Promoções</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex-shrink-0 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Relatórios</span>
            </TabsTrigger>
            <TabsTrigger value="sentiment" className="flex-shrink-0 flex items-center gap-2">
              <Brain className="h-4 w-4" />
              <span className="hidden sm:inline">Sentimento</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="assistant">
            <AIAssistant />
          </TabsContent>

          <TabsContent value="turnover">
            <TurnoverPrediction />
          </TabsContent>

          <TabsContent value="promotion">
            <PromotionSuggestions />
          </TabsContent>

          <TabsContent value="reports">
            <AIReportGenerator />
          </TabsContent>

          <TabsContent value="sentiment">
            <SentimentAnalysis />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AIInsights;
