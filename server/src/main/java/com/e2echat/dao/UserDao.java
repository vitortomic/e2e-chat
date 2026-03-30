package com.e2echat.dao;

import com.e2echat.entity.User;
import org.jdbi.v3.sqlobject.config.RegisterBeanMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.BindBean;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserDao {

    @SqlUpdate("INSERT INTO users (id, username, password_hash, identity_key, signed_pre_key, " +
               "registration_id, device_id, signed_pre_key_id, signed_pre_key_signature, " +
               "signed_pre_key_timestamp, created_at, updated_at) " +
               "VALUES (:id, :username, :passwordHash, :identityKey, :signedPreKey, " +
               ":registrationId, :deviceId, :signedPreKeyId, :signedPreKeySignature, " +
               ":signedPreKeyTimestamp, :createdAt, :updatedAt)")
    void insert(@BindBean User user);

    @SqlQuery("SELECT * FROM users WHERE id = :id")
    @RegisterBeanMapper(User.class)
    Optional<User> findById(@Bind("id") UUID id);

    @SqlQuery("SELECT * FROM users WHERE LOWER(username) = LOWER(:username)")
    @RegisterBeanMapper(User.class)
    Optional<User> findByUsername(@Bind("username") String username);

    @SqlQuery("SELECT id, username FROM users ORDER BY created_at DESC")
    @RegisterBeanMapper(User.class)
    List<User> findAll();

    @SqlUpdate("UPDATE users SET identity_key = :identityKey, signed_pre_key = :signedPreKey, " +
               "signed_pre_key_id = :signedPreKeyId, signed_pre_key_signature = :signedPreKeySignature, " +
               "signed_pre_key_timestamp = :signedPreKeyTimestamp, registration_id = :registrationId, " +
               "device_id = :deviceId WHERE id = :id")
    int updatePublicKeys(@Bind("id") UUID id,
                         @Bind("identityKey") String identityKey,
                         @Bind("signedPreKey") String signedPreKey,
                         @Bind("signedPreKeyId") Integer signedPreKeyId,
                         @Bind("signedPreKeySignature") String signedPreKeySignature,
                         @Bind("signedPreKeyTimestamp") Long signedPreKeyTimestamp,
                         @Bind("registrationId") Integer registrationId,
                         @Bind("deviceId") Integer deviceId);

    @SqlUpdate("DELETE FROM users WHERE id = :id")
    int deleteById(@Bind("id") UUID id);
}
