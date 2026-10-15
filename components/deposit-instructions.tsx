import { Landmark } from "lucide-react";
import { formatMnt } from "@/lib/ui-language";
import { CopyValue } from "./copy-value";
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
        <dd>
          <CopyValue value={deposit.accountNumber} label="Дансны дугаар" />
        </dd>
        <dt>Хүлээн авагч</dt>
        <dd>{deposit.accountHolder}</dd>
        <dt>Гүйлгээний утга</dt>
        <dd>
          <CopyValue value={deposit.reference} label="Гүйлгээний утга" />
        </dd>
      </dl>
      <p>
        Дансны дугаар, гүйлгээний утгыг хуулж банкны аппдаа буулгаарай.
        Урьдчилгааг шилжүүлсний дараа салон шалгаад захиалгыг баталгаажуулна.
      </p>
    </div>
  );
}
