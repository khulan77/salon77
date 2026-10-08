import { Landmark } from "lucide-react";
import { formatMnt } from "@/lib/ui-language";
export type DepositDetails = {
  amountMnt: number;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  reference: string;
};
export function DepositInstructions({ deposit }: { deposit: DepositDetails }) {
  return (
    <div className="deposit-instructions">
      <strong>
        <Landmark size={15} /> Урьдчилгаа: {formatMnt(deposit.amountMnt)}
      </strong>
      <dl>
        <dt>Банк</dt>
        <dd>{deposit.bankName}</dd>
        <dt>Данс</dt>
        <dd>{deposit.accountNumber}</dd>
        <dt>Хүлээн авагч</dt>
        <dd>{deposit.accountHolder}</dd>
        <dt>Гүйлгээний утга</dt>
        <dd>{deposit.reference}</dd>
      </dl>
      <p>
        Урьдчилгааг шилжүүлсний дараа салон шалгаад захиалгыг баталгаажуулна.
      </p>
    </div>
  );
}
