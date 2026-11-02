import { Button } from '@douyinfe/semi-ui';
import { IconFlag, IconFlowChartStroked, IconLock, IconSetting } from '@douyinfe/semi-icons';
import { useI18n } from '../i18n';
import './EmptyState.css';

export interface EmptyStateProps {
  editable: boolean;
  onSetup(): void;
}

type DemoState = 'done' | 'active' | 'pending' | 'end';

function DemoPill(props: { label: string; state: DemoState }) {
  return (
    <span className={`pv-empty__pill pv-empty__pill--${props.state}`}>
      {props.state === 'end' ? <IconFlag size="small" className="pv-empty__flag" /> : <span className="pv-empty__dot" />}
      {props.label}
    </span>
  );
}

const Line = () => <span className="pv-empty__line" aria-hidden />;

/** Onboarding shown until the view has a saved, valid stage field. */
export function EmptyState({ editable, onSetup }: EmptyStateProps) {
  const { t } = useI18n();
  const steps = [1, 2, 3].map((n) => ({
    n,
    title: t(`common.empty.step${n}.title`),
    desc: t(`common.empty.step${n}.desc`),
  }));

  return (
    <div className="pv-empty">
      <div className="pv-empty__card">
        <span className="pv-empty__icon" aria-hidden>
          <IconFlowChartStroked size="extra-large" />
        </span>
        <h1 className="pv-empty__title">{t('common.empty.title')}</h1>
        <p className="pv-empty__desc">{t('common.empty.desc')}</p>

        <div className="pv-empty__graph-wrap" aria-hidden>
          <div className="pv-empty__graph">
            <DemoPill label={t('common.empty.demo.1')} state="done" />
            <Line />
            <DemoPill label={t('common.empty.demo.2')} state="active" />
            <Line />
            <div className="pv-empty__branch">
              <DemoPill label={t('common.empty.demo.3')} state="pending" />
              <DemoPill label={t('common.empty.demo.4')} state="pending" />
              <DemoPill label={t('common.empty.demo.5')} state="pending" />
            </div>
            <Line />
            <DemoPill label={t('common.empty.demo.6')} state="end" />
          </div>
        </div>

        <ol className="pv-empty__steps">
          {steps.map((step) => (
            <li key={step.n} className="pv-empty__step">
              <span className="pv-empty__step-num">{step.n}</span>
              <span className="pv-empty__step-body">
                <span className="pv-empty__step-title">{step.title}</span>
                <span className="pv-empty__step-desc">{step.desc}</span>
              </span>
            </li>
          ))}
        </ol>

        {editable ? (
          <Button theme="solid" type="primary" size="large" icon={<IconSetting />} onClick={onSetup}>
            {t('common.empty.cta')}
          </Button>
        ) : (
          <div className="pv-empty__readonly">
            <IconLock size="small" />
            <span>{t('common.empty.readonly')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
