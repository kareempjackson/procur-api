import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WhatsappService } from './whatsapp.service';
import { SessionStoreRedis } from './session.store.redis';
import { Session } from './session.store';
import { SendService } from './send/send.service';
import { TemplateService } from './templates/template.service';
import { WaQueue } from './wa.queue';
import { SupabaseService } from '../database/supabase.service';
import { AuthService } from '../auth/auth.service';
import { SellersService } from '../sellers/sellers.service';
import { BuyersService } from '../buyers/buyers.service';
import { AiService } from '../ai/ai.service';
import { EventsService } from '../events/events.service';
import { SessionStore } from './session.store';

// ─── In-memory Redis mock ─────────────────────────────────────────────────────

class RedisMock {
  private store = new Map<string, string>();

  async get(key: string) {
    return this.store.get(key) ?? null;
  }

  async set(key: string, val: string, ...args: any[]) {
    if (args.includes('NX') && this.store.has(key)) return null;
    this.store.set(key, val);
    return 'OK';
  }

  async del(...keys: string[]) {
    let deleted = 0;
    for (const k of keys) {
      if (this.store.delete(k)) deleted++;
    }
    return deleted;
  }

  async ping() {
    return 'PONG';
  }

  async expire() {
    return 1;
  }

  // Allow test-level inspection
  _store() {
    return this.store;
  }
}

// ─── In-memory session store mock ────────────────────────────────────────────

class SessionStoreMock {
  private store = new Map<string, Session>();

  async get(id: string): Promise<Session> {
    return this.store.get(id) ?? { flow: 'menu', data: {}, updatedAt: Date.now() };
  }

  async set(id: string, patch: Partial<Session>) {
    const cur = await this.get(id);
    const next: Session = {
      ...cur,
      ...patch,
      data: { ...cur.data, ...(patch.data ?? {}) },
      updatedAt: Date.now(),
    };
    this.store.set(id, next);
    return next;
  }

  async clear(id: string) {
    this.store.delete(id);
  }
}

// ─── Chainable Supabase query builder mock ────────────────────────────────────

function makeQueryBuilder(overrides: Record<string, any> = {}) {
  const builder: any = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockResolvedValue({ data: null, error: null }),
    upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  };
  return builder;
}

function makeSupabaseMock() {
  const qb = makeQueryBuilder();
  const storageBucket = {
    remove: jest.fn().mockResolvedValue({ data: null, error: null }),
  };
  const storage = {
    from: jest.fn().mockReturnValue(storageBucket),
  };
  const clientMock = {
    from: jest.fn().mockReturnValue(qb),
    storage,
  };
  return {
    getClient: jest.fn().mockReturnValue(clientMock),
    findUserByPhoneNumber: jest.fn().mockResolvedValue(null),
    getUserWithOrganization: jest.fn().mockResolvedValue(null),
    deleteAuthUser: jest.fn().mockResolvedValue(undefined),
    updateUser: jest.fn().mockResolvedValue(undefined),
    updateOrganization: jest.fn().mockResolvedValue(undefined),
    findOrganizationById: jest.fn().mockResolvedValue(null),
    // Expose internals for assertions
    _queryBuilder: qb,
    _storage: storageBucket,
  };
}

// ─── Webhook body helpers ─────────────────────────────────────────────────────

function makeTextWebhook(from: string, text: string, msgId = 'msg_1') {
  return {
    entry: [{
      changes: [{
        value: {
          messages: [{ id: msgId, from, type: 'text', text: { body: text } }],
        },
      }],
    }],
  };
}

function makeButtonWebhook(from: string, buttonId: string, msgId = 'msg_2') {
  return {
    entry: [{
      changes: [{
        value: {
          messages: [{
            id: msgId,
            from,
            type: 'interactive',
            interactive: {
              type: 'button_reply',
              button_reply: { id: buttonId, title: '' },
            },
          }],
        },
      }],
    }],
  };
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('WhatsappService', () => {
  let service: WhatsappService;
  let redisMock: RedisMock;
  let sessionStore: SessionStoreMock;
  let supabaseMock: ReturnType<typeof makeSupabaseMock>;
  let sendSvc: { text: jest.Mock; buttons: jest.Mock; list: jest.Mock; image: jest.Mock };

  const PHONE = '14085551234';
  const USER_ID = 'user-uuid-001';
  const ORG_ID = 'org-uuid-001';

  beforeEach(async () => {
    redisMock = new RedisMock();
    sessionStore = new SessionStoreMock();
    supabaseMock = makeSupabaseMock();
    sendSvc = {
      text: jest.fn().mockResolvedValue(undefined),
      buttons: jest.fn().mockResolvedValue(undefined),
      list: jest.fn().mockResolvedValue(undefined),
      image: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsappService,
        { provide: SessionStoreRedis, useValue: sessionStore },
        { provide: 'REDIS', useValue: redisMock },
        { provide: SendService, useValue: sendSvc },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const cfg: Record<string, string> = {
                WHATSAPP_TOKEN: 'test-token',
                WHATSAPP_PHONE_NUMBER_ID: '999000111',
                'whatsapp.token': 'test-token',
                'whatsapp.phoneNumberId': '999000111',
                'storage.privateBucket': 'private',
              };
              return cfg[key] ?? null;
            }),
          },
        },
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: SessionStore, useValue: sessionStore },
        {
          provide: TemplateService,
          useValue: {
            sendOtp: jest.fn().mockResolvedValue(undefined),
            sendNewOrderToSellerIfPaired: jest.fn().mockResolvedValue(undefined),
            sendOrderUpdateIfPaired: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: WaQueue,
          useValue: { enqueueSendMessage: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: AuthService,
          useValue: {
            signup: jest.fn(),
            signin: jest.fn(),
            verifyOtp: jest.fn(),
          },
        },
        {
          provide: SellersService,
          useValue: {},
        },
        {
          provide: BuyersService,
          useValue: {},
        },
        {
          provide: AiService,
          useValue: {
            extractProduct: jest.fn().mockResolvedValue({}),
            extractHarvest: jest.fn().mockResolvedValue({}),
            extractQuote: jest.fn().mockResolvedValue({}),
            extractOrderAction: jest.fn().mockResolvedValue({}),
            moderate: jest.fn().mockResolvedValue({ flagged: false }),
            ragAnswer: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: EventsService,
          useValue: { emit: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<WhatsappService>(WhatsappService);
  });

  // ── Test 1: MENU command ────────────────────────────────────────────────────

  it('sends anonymous menu buttons when unauthenticated user texts "menu"', async () => {
    await service.handleWebhook(makeTextWebhook(PHONE, 'menu'));

    expect(sendSvc.buttons).toHaveBeenCalled();
    // Anonymous user should see Sign up / Login buttons
    const calls = sendSvc.buttons.mock.calls;
    const allButtonIds = calls.flatMap(([, , buttons]) =>
      (buttons as { id: string }[]).map((b) => b.id),
    );
    expect(allButtonIds).toContain('menu_signup');
    expect(allButtonIds).toContain('menu_login');
  });

  // ── Test 2: STOP command (opt-out) ─────────────────────────────────────────

  it('persists opt-out to Redis and Supabase when logged-in user texts "stop"', async () => {
    // Set up a logged-in session
    await sessionStore.set(PHONE, {
      user: { id: USER_ID, orgId: ORG_ID, accountType: 'seller' },
    });

    await service.handleWebhook(makeTextWebhook(PHONE, 'stop', 'msg_stop'));

    // Redis opt-out key set
    expect(await redisMock.get(`wa:optout:${PHONE}`)).toBe('1');

    // Supabase upsert called for whatsapp_optouts
    const qb = supabaseMock._queryBuilder;
    expect(supabaseMock.getClient).toHaveBeenCalled();
    expect(qb.upsert).toHaveBeenCalledWith(
      { phone_e164: PHONE },
      expect.objectContaining({ onConflict: 'phone_e164' }),
    );

    // Confirmation text sent
    expect(sendSvc.text).toHaveBeenCalledWith(
      PHONE,
      expect.stringContaining('opted out'),
    );
  });

  // ── Test 3: DELETE MY DATA — full confirm flow ──────────────────────────────

  it('sends confirmation buttons then purges account on delete_confirm_yes', async () => {
    // Set up a logged-in session with userId + orgId
    await sessionStore.set(PHONE, {
      user: { id: USER_ID, orgId: ORG_ID, accountType: 'seller' },
    });

    // Step 1: user texts "delete my data"
    await service.handleWebhook(makeTextWebhook(PHONE, 'delete my data', 'msg_del_1'));

    // Confirmation buttons should be shown
    const buttonCalls = sendSvc.buttons.mock.calls;
    const confirmButtonIds = buttonCalls.flatMap(([, , buttons]) =>
      (buttons as { id: string }[]).map((b) => b.id),
    );
    expect(confirmButtonIds).toContain('delete_confirm_yes');
    expect(confirmButtonIds).toContain('delete_confirm_no');

    // Session should be in delete_confirm flow
    const session = await sessionStore.get(PHONE);
    expect(session.flow).toBe('delete_confirm');

    // Step 2: user taps Confirm Delete
    jest.clearAllMocks();
    // Re-populate session since clearAllMocks doesn't reset our manual mock
    await sessionStore.set(PHONE, {
      user: { id: USER_ID, orgId: ORG_ID, accountType: 'seller' },
      flow: 'delete_confirm',
    });

    await service.handleWebhook(makeButtonWebhook(PHONE, 'delete_confirm_yes', 'msg_del_2'));

    // Redis keys purged
    expect(await redisMock.get(`wa:session:${PHONE}`)).toBeNull();
    expect(await redisMock.get(`wa:locked:${USER_ID}`)).toBeNull();
    expect(await redisMock.get(`wa:fp:${USER_ID}`)).toBeNull();

    // Supabase soft-delete called
    const qb = supabaseMock._queryBuilder;
    expect(qb.update).toHaveBeenCalledWith({ is_active: false });
    expect(supabaseMock.deleteAuthUser).toHaveBeenCalledWith(USER_ID);

    // Final confirmation text sent
    expect(sendSvc.text).toHaveBeenCalledWith(
      PHONE,
      expect.stringContaining('permanently deleted'),
    );

    // Session cleared (no longer in store)
    const clearedSession = await sessionStore.get(PHONE);
    expect(clearedSession.flow).toBe('menu'); // fresh default session
    expect(clearedSession.user).toBeUndefined();
  });

  // ── Test 4: Idempotency — duplicate message ID ignored ──────────────────────

  it('processes first message and ignores duplicate with same message ID', async () => {
    const DUPE_ID = 'msg_dupe_001';
    const body = makeTextWebhook(PHONE, 'menu', DUPE_ID);

    // First delivery
    await service.handleWebhook(body);
    const firstCallCount = sendSvc.buttons.mock.calls.length;
    expect(firstCallCount).toBeGreaterThan(0);

    // Second delivery with same message ID
    await service.handleWebhook(body);
    // No new calls — duplicate was skipped
    expect(sendSvc.buttons.mock.calls.length).toBe(firstCallCount);
    expect(sendSvc.text.mock.calls.length).toBe(0);
  });
});
